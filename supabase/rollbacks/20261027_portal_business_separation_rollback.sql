-- Restores portal_unit_price to the 20261022 cutover body and removes the portal email-domain trigger.
-- Do not apply from the agent.

begin;

drop trigger if exists profiles_enforce_portal_email_domain on public.profiles;
drop function if exists public.enforce_portal_email_domain();

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
  v_cost := coalesce(p_cost, public.effective_product_cost(p_product_id, null, p_portal));
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

revoke all on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

commit;
