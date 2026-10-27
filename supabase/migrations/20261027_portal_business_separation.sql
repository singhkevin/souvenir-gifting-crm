-- Separate company microsites from the business portal.
-- 1. Portal logins (client_admin / client_user) must match the company's allowed email domains when any are set.
-- 2. portal_unit_price no longer returns business tier prices to a microsite account, or corporate prices to a business account.
--    Store prices stay available. Service role and pricing staff are unchanged.
-- Do not apply from the agent. Idempotent.

begin;

create or replace function public.enforce_portal_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  domains text[];
  email_domain text;
begin
  if new.role not in ('client_admin', 'client_user') or new.company_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.role is not distinct from old.role
     and new.company_id is not distinct from old.company_id
     and lower(coalesce(new.email, '')) is not distinct from lower(coalesce(old.email, '')) then
    return new;
  end if;

  select c.allowed_email_domains
    into domains
  from public.companies c
  where c.id = new.company_id;

  if domains is null or cardinality(domains) = 0 then
    return new;
  end if;

  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));
  if email_domain = '' or not exists (
    select 1
    from unnest(domains) as allowed(domain)
    where lower(btrim(allowed.domain)) = email_domain
  ) then
    raise exception 'portal email domain not allowed';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_portal_email_domain() from public, anon;
grant execute on function public.enforce_portal_email_domain() to authenticated, service_role;

drop trigger if exists profiles_enforce_portal_email_domain on public.profiles;
create trigger profiles_enforce_portal_email_domain
  before insert or update of role, company_id, email
  on public.profiles
  for each row
  execute function public.enforce_portal_email_domain();

comment on function public.enforce_portal_email_domain() is
  'When a company has allowed email domains, client_admin and client_user emails must match. An empty list stays unrestricted.';

-- Replace the permission gate only. The price ladder below is the 20261022 cutover function.
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
set search_path = public
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

  -- Service role and pricing staff may price any portal.
  -- Store prices are retail. Business prices are only for that business account.
  -- Corporate prices are only for that company's microsite account.
  -- A null company id must not reveal the other product's tier.
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and not public.is_pricing_staff()
  then
    if p_portal = 'business' then
      if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.role = 'business_user'
          and (p_company_id is null or p.company_id = p_company_id)
      ) then
        raise exception 'Not permitted';
      end if;
    elsif p_portal = 'corporate' then
      if not exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.role in ('client_admin', 'client_user')
          and p.company_id = p_company_id
      ) then
        raise exception 'Not permitted';
      end if;
    elsif p_portal is distinct from 'store' then
      raise exception 'Not permitted';
    end if;
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

  if p_quote_override is not null and p_quote_override >= 0 then
    return public.pricing_round_money(p_quote_override, v_rounding);
  end if;

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

    select ppm.margin_percent into v_product_margin
    from public.portal_product_margins ppm
    where ppm.product_id = p_product_id
      and ppm.portal = p_portal
    limit 1;
  end if;

  v_cost := coalesce(p_cost, public.effective_product_cost(p_product_id, null, p_portal));
  if v_cost is null then
    return null;
  end if;

  v_company_margin := case when p_portal = 'store' then null else p_company_margin end;
  v_margin := coalesce(v_company_margin, v_product_margin, v_margin);

  if v_margin is not null then
    return public.pricing_round_money(v_cost * (1 + v_margin / 100.0), v_rounding);
  end if;
  return public.pricing_round_money(v_cost, v_rounding);
end;
$function$;

comment on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) is
  'Sell price for store, business, or corporate. Business callers cannot read corporate prices, and microsite callers cannot read business prices.';

revoke all on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

commit;
