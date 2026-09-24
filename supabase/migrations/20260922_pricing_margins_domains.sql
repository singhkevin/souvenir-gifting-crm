-- Phase 1: channel + company margin % and corporate email domain allowlists.
-- Customer-facing price = supplier_cost × (1 + resolved_margin%/100), with legacy
-- products.price as fallback when cost or margin is missing.

alter table public.org_settings
  add column if not exists default_margin_percent numeric,
  add column if not exists b2c_margin_percent numeric,
  add column if not exists b2b_margin_percent numeric;

alter table public.companies
  add column if not exists margin_percent numeric,
  add column if not exists allowed_email_domains text[] not null default '{}'::text[];

comment on column public.org_settings.default_margin_percent is
  'Fallback margin % when channel/company/product margins are unset.';
comment on column public.org_settings.b2c_margin_percent is
  'Default margin % for public retail (B2C) catalogue pricing.';
comment on column public.org_settings.b2b_margin_percent is
  'Default margin % for corporate (B2B) when company has no margin_percent.';
comment on column public.companies.margin_percent is
  'Company-specific sell margin %. Overrides product and channel defaults for B2B.';
comment on column public.companies.allowed_email_domains is
  'If non-empty, portal client emails must be on one of these domains (e.g. acme.com).';

-- Seed margins on the existing settings row when still null (safe to re-run).
update public.org_settings
set
  default_margin_percent = coalesce(default_margin_percent, 35),
  b2c_margin_percent = coalesce(b2c_margin_percent, 40),
  b2b_margin_percent = coalesce(b2b_margin_percent, 35)
where true;

create or replace function public.resolved_sell_price(
  p_supplier_cost numeric,
  p_list_price numeric,
  p_product_margin numeric,
  p_company_margin numeric,
  p_channel text
)
returns numeric
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_global numeric;
  v_b2c numeric;
  v_b2b numeric;
  v_channel_margin numeric;
  v_margin numeric;
begin
  select default_margin_percent, b2c_margin_percent, b2b_margin_percent
    into v_global, v_b2c, v_b2b
  from public.org_settings
  limit 1;

  if lower(coalesce(p_channel, 'b2b')) = 'b2c' then
    v_channel_margin := v_b2c;
  else
    v_channel_margin := v_b2b;
  end if;

  -- Company → product → channel → global. Explicit 0 is a valid margin.
  v_margin := coalesce(p_company_margin, p_product_margin, v_channel_margin, v_global);

  if p_supplier_cost is not null and v_margin is not null then
    return round(p_supplier_cost * (1 + v_margin / 100.0), 2);
  end if;

  return round(coalesce(p_list_price, p_supplier_cost, 0)::numeric, 2);
end;
$$;

comment on function public.resolved_sell_price(numeric, numeric, numeric, numeric, text) is
  'Sell price from cost + margin hierarchy. Falls back to list price when cost/margin missing.';

revoke all on function public.resolved_sell_price(numeric, numeric, numeric, numeric, text) from public;
grant execute on function public.resolved_sell_price(numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.resolved_sell_price(numeric, numeric, numeric, numeric, text) to service_role;

-- Portal catalogue: expose resolved B2B price for the caller's company (never cost).
drop view if exists public.client_products;

create view public.client_products as
select
  p.id,
  p.name,
  p.sku,
  p.description,
  p.image_url,
  public.resolved_sell_price(
    p.supplier_cost,
    p.price,
    p.internal_margin,
    (select c.margin_percent from public.companies c where c.id = public.client_company_id()),
    'b2b'
  ) as price,
  p.moq,
  p.category_id,
  cat.name as category_name,
  p.subcategory_id,
  sub.name as subcategory_name,
  p.brand_id,
  b.name as brand_name
from public.products p
left join public.categories cat on cat.id = p.category_id
left join public.subcategories sub on sub.id = p.subcategory_id
left join public.brands b on b.id = p.brand_id
where p.status = 'active'
  and p.catalogue_access <> 'none'
  and (
    p.catalogue_access = 'all'
    or exists (
      select 1
      from public.company_product_access cpa
      where cpa.product_id = p.id
        and cpa.company_id = public.client_company_id()
    )
  );

comment on view public.client_products is
  'Client-safe catalogue with company-aware sell price. No cost, supplier, or margin columns.';

revoke all on public.client_products from anon;
grant select on public.client_products to authenticated;
