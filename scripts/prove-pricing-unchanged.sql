-- Run on a database AFTER applying 20261021_pricing_engine.sql and BEFORE editing Pricing.
-- Proves portal_unit_price matches the previous ladder for every active product, company, and catalog line.
-- It does not change data. It raises if any price moved, or if the seeded settings were already edited.
-- Do not run this against production until Kevin has applied the migration on a copy or staging database.

do $$
declare
  v_bad integer;
begin
  if exists (
    select 1
    from public.org_settings s
    where s.store_price_base is distinct from 'retail'
       or s.business_price_base is distinct from 'retail'
       or s.corporate_price_base is distinct from 'retail'
       or s.store_margin_percent is not null
       or s.business_margin_percent is not null
       or s.corporate_margin_percent is not null
       or s.store_rounding is distinct from 'none'
       or s.business_rounding is distinct from 'none'
       or s.corporate_rounding is distinct from 'none'
       or s.store_no_cost_fallback is distinct from 'retail_margin'
       or s.business_no_cost_fallback is distinct from 'retail_margin'
       or s.corporate_no_cost_fallback is distinct from 'retail_margin'
  ) then
    raise exception 'Portal rules are no longer at the day-one seed, so this proof does not apply.';
  end if;

  if exists (select 1 from public.portal_product_prices) then
    raise exception 'portal_product_prices already has rows. Clear them or skip this proof.';
  end if;

  select count(*) into v_bad
  from public.products p
  where p.status = 'active'
    and public.portal_unit_price('store', p.id, null, p.price, null, null, null, null)
        is distinct from round(greatest(coalesce(p.price, 0), 0), 2);
  if v_bad > 0 then
    raise exception 'Store prices changed for % active products', v_bad;
  end if;

  select count(*) into v_bad
  from public.products p
  cross join public.companies c
  where p.status = 'active'
    and public.portal_unit_price('business', p.id, c.id, p.price, null, c.margin_percent, null, null)
        is distinct from round(coalesce(
          (
            select cpp.price
            from public.company_product_prices cpp
            where cpp.company_id = c.id
              and cpp.product_id = p.id
              and cpp.price >= 0
              and (cpp.valid_until is null or cpp.valid_until >= current_date)
            limit 1
          ),
          case
            when c.margin_percent is not null then coalesce(p.price, 0) * (1 + c.margin_percent / 100.0)
            else greatest(coalesce(p.price, 0), 0)
          end
        ), 2);
  if v_bad > 0 then
    raise exception 'Business prices changed for % product/company pairs', v_bad;
  end if;

  select count(*) into v_bad
  from public.products p
  cross join public.companies c
  where p.status = 'active'
    and public.portal_unit_price('corporate', p.id, c.id, p.price, null, c.margin_percent, null, null)
        is distinct from public.portal_unit_price('business', p.id, c.id, p.price, null, c.margin_percent, null, null);
  if v_bad > 0 then
    raise exception 'Corporate prices differ from business prices for % pairs while no catalog price is passed', v_bad;
  end if;

  select count(*) into v_bad
  from public.campaign_products cp
  join public.products p on p.id = cp.product_id
  join public.companies c on true
  where p.status = 'active'
    and cp.pack_option is null
    and cp.pack_kit_id is null
    and public.portal_unit_price('corporate', p.id, c.id, p.price, null, c.margin_percent, cp.manual_price, null)
        is distinct from round(coalesce(
          (
            select cpp.price
            from public.company_product_prices cpp
            where cpp.company_id = c.id
              and cpp.product_id = p.id
              and cpp.price >= 0
              and (cpp.valid_until is null or cpp.valid_until >= current_date)
            limit 1
          ),
          case when cp.manual_price is not null and cp.manual_price >= 0 then cp.manual_price end,
          case
            when c.margin_percent is not null then coalesce(p.price, 0) * (1 + c.margin_percent / 100.0)
            else greatest(coalesce(p.price, 0), 0)
          end
        ), 2);
  if v_bad > 0 then
    raise exception 'Corporate catalog prices changed for % lines', v_bad;
  end if;

  raise notice 'Pricing unchanged: store, business, and corporate match the previous ladder.';
end;
$$;
