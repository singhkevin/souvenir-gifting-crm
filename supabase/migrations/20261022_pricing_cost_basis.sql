-- Pricing phase 1: every sell price is built from one effective cost.
--
-- * products.price ("Retail") stops being a pricing input. It is frozen read-only for one release
--   (a trigger keeps the old value on update; new rows get 0) and is dropped in a later release.
-- * Store and Retail are one concept: the store price is cost plus the store margin.
-- * product_costs.cost_source picks the cost basis per product:
--     manual    product_costs.supplier_cost (default, every product on day one)
--     preferred the pinned preferred supplier offer when it is eligible, else the manual cost
--     lowest    the best eligible offer (a pinned preferred offer wins), else the manual cost
--   Eligible: active, in stock when org_settings.best_cost_require_in_stock, and moq <= quantity
--   (quantity defaults to the product MOQ for listed prices).
--   public.effective_product_cost(product, quantity) is the one function; src/lib/pricing/cost-basis.ts mirrors it.
-- * Precedence in portal_unit_price:
--     locked quote price > company fixed > corporate catalog manual (packs keep their stored price)
--     > portal fixed per product > company margin > per-product portal margin (new) > portal default margin.
--   No cost means price on quote (null).
-- * company_product_prices.portal (null = business and corporate, as before) lets a company price
--   apply to one portal. Phase 1 uses it only for the retail migration rows.
-- * Day one keeps every active price: corporate moves from retail to cost with a 0% default margin.
--   Active products whose retail differs from cost get a corporate fixed price = today's retail, and each
--   company with a non-zero margin gets a corporate-only company price = retail x (1 + margin) with
--   corporate rounding, unless it already has a company price for that product. All are recorded with
--   source 'migrated_from_retail' and in price_change_log. Discontinued products are not migrated.
-- * The price * 0.62 cost fallbacks are removed. Order and quote costs use effective_product_cost.
--
-- Phase 2 TODO: quantity tiers (offer and sell), per-portal company margins, supplier currency and FX,
-- GST-inclusive supplier costs (phase 1 treats every cost as INR excluding GST), stale-offer expiry.
--
-- Do not apply from the agent. Rollback: supabase/rollbacks/20261022_pricing_cost_basis_rollback.sql
-- Dry run: supabase/tests/pricing_cost_basis_check.sql (built by scripts/build-pricing-dry-run.mjs).

begin;

-- 1. Cost basis per product -------------------------------------------------------------------
alter table public.product_costs
  add column if not exists cost_source text not null default 'manual';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_costs_cost_source_check') then
    alter table public.product_costs
      add constraint product_costs_cost_source_check check (cost_source in ('manual', 'preferred', 'lowest'));
  end if;
end $$;

comment on column public.product_costs.cost_source is
  'manual = supplier_cost. preferred = pinned preferred offer when eligible, else supplier_cost. lowest = best eligible offer (pinned preferred wins), else supplier_cost.';

create or replace function public.effective_product_cost(p_product_id uuid, p_quantity integer default null)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_source text;
  v_manual numeric;
  v_qty integer;
  v_require_stock boolean;
  v_offer numeric;
begin
  if p_product_id is null then
    return null;
  end if;

  select pc.cost_source, pc.supplier_cost
    into v_source, v_manual
  from public.product_costs pc
  where pc.product_id = p_product_id;

  v_source := coalesce(v_source, 'manual');
  if v_source = 'manual' then
    return v_manual;
  end if;

  -- Listed prices use the product MOQ, so an offer that needs more than the MOQ is not used for them.
  v_qty := coalesce(
    p_quantity,
    (select greatest(coalesce(p.moq, 1), 1) from public.products p where p.id = p_product_id),
    1
  );

  if v_source = 'preferred' then
    select coalesce(s.best_cost_require_in_stock, true) into v_require_stock from public.org_settings s limit 1;
    v_require_stock := coalesce(v_require_stock, true);
    select o.cost into v_offer
    from public.product_supplier_offers o
    where o.product_id = p_product_id
      and o.is_preferred
      and o.is_active
      and (not v_require_stock or o.in_stock)
      and o.moq <= v_qty
    limit 1;
  else
    v_offer := public.best_supplier_cost(p_product_id, v_qty);
  end if;

  -- TODO phase 2: quantity tiers, supplier currency/FX, GST-inclusive costs, stale offers.
  return coalesce(v_offer, v_manual);
end;
$$;

comment on function public.effective_product_cost(uuid, integer) is
  'The one cost every sell price and order cost is built from. Mirrored by src/lib/pricing/cost-basis.ts.';

revoke all on function public.effective_product_cost(uuid, integer) from public, anon, authenticated;
grant execute on function public.effective_product_cost(uuid, integer) to service_role;

-- 2. Per-product portal margin ---------------------------------------------------------------
create table if not exists public.portal_product_margins (
  product_id uuid not null references public.products (id) on delete cascade,
  portal text not null check (portal in ('store', 'business', 'corporate')),
  margin_percent numeric not null check (margin_percent >= 0),
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, portal)
);

comment on table public.portal_product_margins is
  'Margin over cost for one product on one portal. Below fixed prices and the company margin, above the portal default margin.';

alter table public.portal_product_margins enable row level security;
revoke all on table public.portal_product_margins from public, anon;
grant select, insert, update, delete on table public.portal_product_margins to authenticated;
grant all on table public.portal_product_margins to service_role;

drop policy if exists portal_product_margins_read on public.portal_product_margins;
create policy portal_product_margins_read
  on public.portal_product_margins
  for select
  using (public.is_pricing_viewer());

drop policy if exists portal_product_margins_write on public.portal_product_margins;
create policy portal_product_margins_write
  on public.portal_product_margins
  for all
  using (public.is_pricing_editor())
  with check (public.is_pricing_editor());

-- 3. Where a fixed price came from; company prices for one portal ------------------------------
alter table public.portal_product_prices
  add column if not exists source text not null default 'manual';
alter table public.company_product_prices
  add column if not exists source text not null default 'manual';
alter table public.company_product_prices
  add column if not exists portal text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'portal_product_prices_source_check') then
    alter table public.portal_product_prices
      add constraint portal_product_prices_source_check check (source in ('manual', 'migrated_from_retail'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_product_prices_source_check') then
    alter table public.company_product_prices
      add constraint company_product_prices_source_check check (source in ('manual', 'migrated_from_retail'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'company_product_prices_portal_check') then
    alter table public.company_product_prices
      add constraint company_product_prices_portal_check check (portal is null or portal in ('business', 'corporate'));
  end if;
end $$;

comment on column public.company_product_prices.portal is
  'Null = business and corporate (as before). business or corporate = that portal only.';

-- 4. The engine ------------------------------------------------------------------------------
-- Signature unchanged. p_retail is ignored (kept so existing callers compile).
create or replace function public.portal_unit_price(
  p_portal text,
  p_product_id uuid,
  p_company_id uuid,
  p_retail numeric,
  p_cost numeric,
  p_company_margin numeric,
  p_catalog_manual numeric,
  p_quote_override numeric default null::numeric
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_cost numeric;
  v_margin numeric;
  v_product_margin numeric;
  v_company_margin numeric;
  v_rounding text;
  v_special numeric;
  v_fixed numeric;
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

  select
    case p_portal
      when 'store' then s.store_margin_percent
      when 'business' then s.business_margin_percent
      else s.corporate_margin_percent
    end,
    case p_portal
      when 'store' then s.store_rounding
      when 'business' then s.business_rounding
      else s.corporate_rounding
    end
  into v_margin, v_rounding
  from public.org_settings s
  limit 1;

  v_rounding := coalesce(v_rounding, 'none');

  -- 1. Locked quote price.
  if p_quote_override is not null and p_quote_override >= 0 then
    return public.pricing_round_money(p_quote_override, v_rounding);
  end if;

  -- 2. Company fixed price (business and corporate; a row may be limited to one portal).
  if p_portal <> 'store' and p_company_id is not null and p_product_id is not null then
    select cpp.price into v_special
    from public.company_product_prices cpp
    where cpp.company_id = p_company_id
      and cpp.product_id = p_product_id
      and cpp.price >= 0
      and (cpp.portal is null or cpp.portal = p_portal)
      and (cpp.valid_until is null or cpp.valid_until >= current_date)
    limit 1;
    if v_special is not null then
      return public.pricing_round_money(v_special, v_rounding);
    end if;
  end if;

  -- 3. Corporate catalog manual price. Pack lines keep their stored price in the callers.
  if p_portal = 'corporate' and p_catalog_manual is not null and p_catalog_manual >= 0 then
    return public.pricing_round_money(p_catalog_manual, v_rounding);
  end if;

  -- 4. Portal fixed price for this product.
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

    select ppm.margin_percent into v_product_margin
    from public.portal_product_margins ppm
    where ppm.product_id = p_product_id
      and ppm.portal = p_portal
    limit 1;
  end if;

  -- 5-7. Cost plus company margin, else the product's portal margin, else the portal default margin.
  v_cost := coalesce(p_cost, public.effective_product_cost(p_product_id, null));
  if v_cost is null then
    return null; -- price on quote
  end if;

  v_company_margin := case when p_portal = 'store' then null else p_company_margin end;
  v_margin := coalesce(v_company_margin, v_product_margin, v_margin);

  if v_margin is not null then
    return public.pricing_round_money(v_cost * (1 + v_margin / 100.0), v_rounding);
  end if;
  return public.pricing_round_money(v_cost, v_rounding);
end;
$function$;

-- 5. Settings: corporate on cost at 0%, missing cost = price on quote -----------------------------
insert into public.price_change_log (actor_id, product_id, company_id, portal, field, old_value, new_value)
select null::uuid, null::uuid, null::uuid, x.portal, x.field, x.old_value, x.new_value
from public.org_settings s
cross join lateral (values
  ('corporate', 'price_base', s.corporate_price_base::text, 'cost'),
  ('corporate', 'margin_percent', s.corporate_margin_percent::text, coalesce(s.corporate_margin_percent, 0)::text),
  ('store', 'no_cost_fallback', s.store_no_cost_fallback::text, 'on_quote'),
  ('business', 'no_cost_fallback', s.business_no_cost_fallback::text, 'on_quote'),
  ('corporate', 'no_cost_fallback', s.corporate_no_cost_fallback::text, 'on_quote')
) as x(portal, field, old_value, new_value)
where x.old_value is distinct from x.new_value;

update public.org_settings
set store_price_base = 'cost',
    business_price_base = 'cost',
    corporate_price_base = 'cost',
    corporate_margin_percent = coalesce(corporate_margin_percent, 0),
    store_no_cost_fallback = 'on_quote',
    business_no_cost_fallback = 'on_quote',
    corporate_no_cost_fallback = 'on_quote';

-- 6. Day-one price preservation (active products whose retail differs from cost) -----------------
create temporary table _retail_migration on commit drop as
select p.id as product_id, p.price as retail
from public.products p
join public.product_costs pc on pc.product_id = p.id
where p.status = 'active'
  and p.price is distinct from pc.supplier_cost;

insert into public.portal_product_prices (product_id, portal, price, valid_until, source)
select m.product_id, 'corporate', m.retail, null, 'migrated_from_retail'
from _retail_migration m
where not exists (
  select 1 from public.portal_product_prices ppp
  where ppp.product_id = m.product_id and ppp.portal = 'corporate'
);

insert into public.company_product_prices (company_id, product_id, price, valid_until, portal, source)
select c.id, m.product_id,
       public.pricing_round_money(m.retail * (1 + c.margin_percent / 100.0),
         coalesce((select s.corporate_rounding from public.org_settings s limit 1), 'none')),
       null, 'corporate', 'migrated_from_retail'
from _retail_migration m
cross join public.companies c
where c.margin_percent is not null
  and c.margin_percent <> 0
  and not exists (
    select 1 from public.company_product_prices cpp
    where cpp.company_id = c.id and cpp.product_id = m.product_id
  );

insert into public.price_change_log (actor_id, product_id, company_id, portal, field, old_value, new_value)
select null::uuid, ppp.product_id, null::uuid, 'corporate', 'migrated_from_retail', m.retail::text, ppp.price::text
from public.portal_product_prices ppp
join _retail_migration m on m.product_id = ppp.product_id
where ppp.portal = 'corporate' and ppp.source = 'migrated_from_retail'
union all
select null::uuid, cpp.product_id, cpp.company_id, 'corporate', 'migrated_from_retail', m.retail::text, cpp.price::text
from public.company_product_prices cpp
join _retail_migration m on m.product_id = cpp.product_id
where cpp.source = 'migrated_from_retail';

-- 7. Order and quote functions: effective cost, no price * 0.62, no retail argument ------------
do $$
declare
  v_def text;
  v_old text;
  v_new text;
  v_hits integer;
  v_fn text;
begin
  -- place_direct_order: retail is no longer passed; order cost uses the effective cost at the ordered quantity.
  v_fn := 'public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)';
  v_def := pg_get_functiondef(v_fn::regprocedure);
  if position('effective_product_cost' in v_def) = 0 then
    v_old := $o$public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, cp.manual_price)$o$;
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 2 then raise exception 'place_direct_order: expected 2 catalog listed prices, found %', v_hits; end if;
    v_def := replace(v_def, v_old, $n$public.listed_unit_price(p_company_id, v_product.id, null, v_company_margin, cp.manual_price)$n$);

    v_old := $o$public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, null)$o$;
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then raise exception 'place_direct_order: expected 1 portal listed price, found %', v_hits; end if;
    v_def := replace(v_def, v_old, $n$public.listed_unit_price(p_company_id, v_product.id, null, v_company_margin, null)$n$);

    v_old := $o$public.portal_unit_price('store', v_product.id, null, v_product.price, null, null, null, null)$o$;
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then raise exception 'place_direct_order: expected 1 store price, found %', v_hits; end if;
    v_def := replace(v_def, v_old, $n$public.portal_unit_price('store', v_product.id, null, null, null, null, null, null)$n$);

    v_old := $o$v_unit_cost := (select pc.supplier_cost from public.product_costs pc where pc.product_id = v_product.id);$o$;
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then raise exception 'place_direct_order: expected 1 unit cost, found %', v_hits; end if;
    v_def := replace(v_def, v_old, $n$v_unit_cost := public.effective_product_cost(v_product.id, v_qty);$n$);
    execute v_def;
  end if;

  -- Quote acceptance and conversion: order cost from the effective cost, no retail fallback.
  foreach v_fn in array array[
    'public.client_respond_quotation(uuid,text,text,uuid[])',
    'public.convert_quotation_to_order(uuid)',
    'public.place_quote_order(text,jsonb)'
  ] loop
    v_def := pg_get_functiondef(v_fn::regprocedure);
    v_old := $o$coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62)$o$;
    if position('effective_product_cost' in v_def) = 0 then
      v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
      if v_hits <> 1 then raise exception '%: expected 1 cost fallback, found %', v_fn, v_hits; end if;
      execute replace(v_def, v_old, $n$coalesce(public.effective_product_cost(p.id, qi.quantity::integer), 0)$n$);
    end if;
  end loop;
end $$;

-- 8. Views: no raw retail ----------------------------------------------------------------------
create or replace view public.client_products as
 SELECT p.id,
    p.name,
    p.sku,
    p.description,
    p.image_url,
        CASE
            WHEN (COALESCE(( SELECT s.portal_show_sell_price
               FROM org_settings s
             LIMIT 1), true) IS FALSE) THEN NULL::numeric
            ELSE listed_unit_price(client_company_id(), p.id, NULL::numeric, ( SELECT c.margin_percent
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

-- portal_catalogue is not read by the app. Its price was raw retail; it is now the company's corporate price.
create or replace view public.portal_catalogue as
 SELECT p.id,
    p.name,
    p.description,
    (CASE
        WHEN (COALESCE(( SELECT s.portal_show_sell_price
           FROM org_settings s
         LIMIT 1), true) IS FALSE) THEN NULL::numeric
        ELSE listed_unit_price(client_company_id(), p.id, NULL::numeric, ( SELECT co.margin_percent
           FROM companies co
          WHERE (co.id = client_company_id())), NULL::numeric)
    END)::numeric(12,2) AS price,
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

-- 9. Freeze products.price for one release ------------------------------------------------------
alter table public.products alter column price set default 0;

comment on column public.products.price is
  'Frozen legacy retail price. Not a pricing input since 20261022_pricing_cost_basis. Read-only; dropped in a later release.';

create or replace function public.freeze_product_price()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.price := 0;
  elsif new.price is distinct from old.price then
    new.price := old.price;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_freeze_product_price on public.products;
create trigger trg_freeze_product_price
  before insert or update of price on public.products
  for each row execute function public.freeze_product_price();

commit;
