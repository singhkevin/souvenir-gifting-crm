-- Rollback for 20261022_pricing_cost_basis.sql.
-- Restores portal_unit_price, the two views and the order/quote functions exactly as they were on live
-- (2026-10-22, before the migration), deletes the 'migrated_from_retail' rows, puts the org settings back
-- (corporate on retail with no default margin, missing cost falls back to retail), and drops the new
-- columns, table and functions. products.price was frozen, so it still holds the pre-migration values.
-- Manual per-product portal margins and cost_source choices made after the migration are lost.

begin;

drop trigger if exists trg_freeze_product_price on public.products;
drop function if exists public.freeze_product_price();
alter table public.products alter column price drop default;
comment on column public.products.price is null;

CREATE OR REPLACE FUNCTION public.portal_unit_price(p_portal text, p_product_id uuid, p_company_id uuid, p_retail numeric, p_cost numeric, p_company_margin numeric, p_catalog_manual numeric, p_quote_override numeric DEFAULT NULL::numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_retail numeric;
  v_cost numeric;
  v_margin numeric;
  v_company_margin numeric;
  v_base_mode text;
  v_fallback text;
  v_rounding text;
  v_special numeric;
  v_fixed numeric;
  v_price numeric;
  v_use_cost boolean;
begin
  if p_portal not in ('store', 'business', 'corporate') then
    return null;
  end if;

  -- Returns a sell price only. Cost stays inside this function.
  -- Service role and pricing staff may price any company. A client may price only their company.
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and not public.is_pricing_staff()
     and p_company_id is not null
     and p_company_id is distinct from public.client_company_id()
     and not exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.is_active
         and p.role = 'business_user'
         and p.company_id = p_company_id
     )
  then
    raise exception 'Not permitted';
  end if;

  v_retail := coalesce(p_retail, (select p.price from public.products p where p.id = p_product_id));
  v_cost := coalesce(p_cost, (select pc.supplier_cost from public.product_costs pc where pc.product_id = p_product_id));

  select
    case p_portal
      when 'store' then s.store_margin_percent
      when 'business' then s.business_margin_percent
      else s.corporate_margin_percent
    end,
    case p_portal
      when 'store' then s.store_price_base
      when 'business' then s.business_price_base
      else s.corporate_price_base
    end,
    case p_portal
      when 'store' then s.store_no_cost_fallback
      when 'business' then s.business_no_cost_fallback
      else s.corporate_no_cost_fallback
    end,
    case p_portal
      when 'store' then s.store_rounding
      when 'business' then s.business_rounding
      else s.corporate_rounding
    end
  into v_margin, v_base_mode, v_fallback, v_rounding
  from public.org_settings s
  limit 1;

  v_base_mode := coalesce(v_base_mode, 'retail');
  v_fallback := coalesce(v_fallback, 'retail_margin');
  v_rounding := coalesce(v_rounding, 'none');

  if p_quote_override is not null and p_quote_override >= 0 then
    return public.pricing_round_money(p_quote_override, v_rounding);
  end if;

  if p_portal <> 'store' and p_company_id is not null and p_product_id is not null then
    select cpp.price into v_special
    from public.company_product_prices cpp
    where cpp.company_id = p_company_id
      and cpp.product_id = p_product_id
      and cpp.price >= 0
      and (cpp.valid_until is null or cpp.valid_until >= current_date)
    limit 1;
    if v_special is not null then
      return public.pricing_round_money(v_special, v_rounding);
    end if;
  end if;

  if p_portal = 'corporate' and p_catalog_manual is not null and p_catalog_manual >= 0 then
    return public.pricing_round_money(p_catalog_manual, v_rounding);
  end if;

  if p_product_id is not null then
    select ppp.price into v_fixed
    from public.portal_product_prices ppp
    where ppp.product_id = p_product_id
      and ppp.portal = p_portal
      and ppp.price >= 0
      and (ppp.valid_until is null or ppp.valid_until >= current_date)
    limit 1;
    if v_fixed is not null then
      return public.pricing_round_money(v_fixed, v_rounding);
    end if;
  end if;

  v_use_cost := v_base_mode = 'cost';
  v_company_margin := case when p_portal = 'store' then null else p_company_margin end;

  if v_use_cost and v_cost is not null then
    if coalesce(v_company_margin, v_margin) is not null then
      v_price := v_cost * (1 + coalesce(v_company_margin, v_margin) / 100.0);
    else
      v_price := v_cost;
    end if;
  elsif v_use_cost and v_cost is null and v_fallback = 'on_quote' then
    return null;
  elsif p_portal = 'store' and not v_use_cost then
    v_price := greatest(coalesce(v_retail, 0), 0);
  elsif coalesce(v_company_margin, v_margin) is not null then
    v_price := coalesce(v_retail, 0) * (1 + coalesce(v_company_margin, v_margin) / 100.0);
  else
    v_price := greatest(coalesce(v_retail, 0), 0);
  end if;

  return public.pricing_round_money(v_price, v_rounding);
end;
$function$;

create or replace view public.client_products as  SELECT p.id,
    p.name,
    p.sku,
    p.description,
    p.image_url,
        CASE
            WHEN (COALESCE(( SELECT s.portal_show_sell_price
               FROM org_settings s
             LIMIT 1), true) IS FALSE) THEN NULL::numeric
            ELSE listed_unit_price(client_company_id(), p.id, p.price, ( SELECT c.margin_percent
               FROM companies c
              WHERE (c.id = client_company_id())), NULL::numeric)
        END AS price,
    p.moq,
    p.stock_qty,
    p.fulfillment_mode,
    p.category_id,
    cat.name AS category_name,
    p.subcategory_id,
    sub.name AS subcategory_name,
    p.brand_id,
    b.name AS brand_name
   FROM (((products p
     LEFT JOIN categories cat ON ((cat.id = p.category_id)))
     LEFT JOIN subcategories sub ON ((sub.id = p.subcategory_id)))
     LEFT JOIN brands b ON ((b.id = p.brand_id)))
  WHERE ((p.status = 'active'::product_status) AND (p.catalogue_access <> 'none'::text) AND ((p.catalogue_access = 'all'::text) OR (EXISTS ( SELECT 1
           FROM company_product_access cpa
          WHERE ((cpa.product_id = p.id) AND (cpa.company_id = client_company_id()))))) AND (NOT (EXISTS ( SELECT 1
           FROM company_product_exclusions cpe
          WHERE ((cpe.product_id = p.id) AND (cpe.company_id = client_company_id()))))));

create or replace view public.portal_catalogue as  SELECT p.id,
    p.name,
    p.description,
    p.price,
    p.moq,
    p.image_url,
    p.status,
    p.category_id,
    p.brand_id,
    c.name AS category_name,
    b.name AS brand_name
   FROM ((products p
     LEFT JOIN categories c ON ((c.id = p.category_id)))
     LEFT JOIN brands b ON ((b.id = p.brand_id)))
  WHERE ((p.status = 'active'::product_status) AND (client_company_id() IS NOT NULL) AND ((p.catalogue_access = 'all'::text) OR ((p.catalogue_access = 'selected'::text) AND (EXISTS ( SELECT 1
           FROM company_product_access a
          WHERE ((a.product_id = p.id) AND (a.company_id = client_company_id())))))));

do $$
declare
  v_def text;
  v_fn text;
begin
  v_fn := 'public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)';
  v_def := pg_get_functiondef(v_fn::regprocedure);
  if position('effective_product_cost' in v_def) > 0 then
    v_def := replace(v_def,
      $n$public.listed_unit_price(p_company_id, v_product.id, null, v_company_margin, cp.manual_price)$n$,
      $o$public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, cp.manual_price)$o$);
    v_def := replace(v_def,
      $n$public.listed_unit_price(p_company_id, v_product.id, null, v_company_margin, null)$n$,
      $o$public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, null)$o$);
    v_def := replace(v_def,
      $n$public.portal_unit_price('store', v_product.id, null, null, null, null, null, null)$n$,
      $o$public.portal_unit_price('store', v_product.id, null, v_product.price, null, null, null, null)$o$);
    v_def := replace(v_def,
      $n$v_unit_cost := public.effective_product_cost(v_product.id, v_qty);$n$,
      $o$v_unit_cost := (select pc.supplier_cost from public.product_costs pc where pc.product_id = v_product.id);$o$);
    if position('effective_product_cost' in v_def) > 0 then
      raise exception 'place_direct_order: could not restore every patched line';
    end if;
    execute v_def;
  end if;

  foreach v_fn in array array[
    'public.client_respond_quotation(uuid,text,text,uuid[])',
    'public.convert_quotation_to_order(uuid)',
    'public.place_quote_order(text,jsonb)'
  ] loop
    v_def := pg_get_functiondef(v_fn::regprocedure);
    if position('effective_product_cost' in v_def) > 0 then
      v_def := replace(v_def,
        $n$coalesce(public.effective_product_cost(p.id, qi.quantity::integer), 0)$n$,
        $o$coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62)$o$);
      if position('effective_product_cost' in v_def) > 0 then
        raise exception '%: could not restore the cost fallback', v_fn;
      end if;
      execute v_def;
    end if;
  end loop;
end $$;

delete from public.company_product_prices where source = 'migrated_from_retail';
delete from public.portal_product_prices where source = 'migrated_from_retail';
delete from public.price_change_log where field = 'migrated_from_retail';

update public.org_settings
set corporate_price_base = 'retail',
    corporate_margin_percent = null,
    store_no_cost_fallback = 'retail_margin',
    business_no_cost_fallback = 'retail_margin',
    corporate_no_cost_fallback = 'retail_margin';

alter table public.company_product_prices drop constraint if exists company_product_prices_portal_check;
alter table public.company_product_prices drop constraint if exists company_product_prices_source_check;
alter table public.portal_product_prices drop constraint if exists portal_product_prices_source_check;
alter table public.company_product_prices drop column if exists portal;
alter table public.company_product_prices drop column if exists source;
alter table public.portal_product_prices drop column if exists source;

drop table if exists public.portal_product_margins;
drop function if exists public.effective_product_cost(uuid, integer);

alter table public.product_costs drop constraint if exists product_costs_cost_source_check;
alter table public.product_costs drop column if exists cost_source;

commit;
