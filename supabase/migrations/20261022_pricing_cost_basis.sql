-- Pricing phase 1, step 1 of 2: cost-basis SCHEMA ONLY (additive, backward compatible).
--
-- Safe to apply while production still runs origin/main: it adds columns with defaults, one new table
-- and one new function, and changes no existing function, view, trigger, setting or price.
--   * org_settings.{store,business,corporate}_default_cost_source (manual | preferred | lowest, default manual)
--   * product_costs.cost_source (portal_default | manual | preferred | lowest, default portal_default)
--   * public.company_pricing_portal(company) (business or corporate; nothing calls it yet)
--   * public.effective_product_cost(product, quantity, portal) (service_role only; nothing calls it yet)
--   * public.portal_product_margins (per-product margin per portal; empty)
--   * portal_product_prices.source, company_product_prices.source (default manual),
--     company_product_prices.portal (null = business and corporate, exactly as today)
-- origin/main keeps working unchanged: it never names these columns, product_costs upserts and
-- company_product_prices upserts (on company_id, product_id) still succeed, and every price is the same.
--
-- Step 2, 20261022_pricing_cost_basis_cutover.sql, switches pricing to cost. Apply it only together with
-- the deploy of the matching app code (it is NOT compatible with origin/main; see that file).
--
-- Cost source rules (portal_default first resolves to that portal's default_cost_source):
--     manual    product_costs.supplier_cost (default, every product on day one)
--     preferred the pinned preferred supplier offer when it is eligible, else the manual cost
--     lowest    the best eligible offer (a pinned preferred offer wins), else the manual cost
--   Eligible: active, in stock when org_settings.best_cost_require_in_stock, and moq <= quantity
--   (quantity defaults to the product MOQ for listed prices).
--   src/lib/pricing/cost-basis.ts mirrors effective_product_cost.
--
-- Phase 2 TODO: quantity tiers (offer and sell), per-portal company margins, supplier currency and FX,
-- GST-inclusive supplier costs (phase 1 treats every cost as INR excluding GST), stale-offer expiry.
--
-- Applied to production 2026-10-22 (~12:48 IST, approved by Kevin). Rollback: supabase/rollbacks/20261022_pricing_cost_basis_rollback.sql
-- Dry run: supabase/tests/pricing_cost_basis_check.sql (built by scripts/build-pricing-dry-run.mjs).

begin;

-- 1. Cost basis: a default per portal, an override per product ---------------------------------
-- Each portal rule has a default cost source (manual on day one). A product follows the portal default
-- unless it picks manual, preferred or lowest, which then applies on every portal.
alter table public.org_settings
  add column if not exists store_default_cost_source text not null default 'manual',
  add column if not exists business_default_cost_source text not null default 'manual',
  add column if not exists corporate_default_cost_source text not null default 'manual';

-- Every existing product gets portal_default (the column default). Portal defaults are manual, so the
-- effective cost is the stored supplier_cost for every product, as today.
alter table public.product_costs
  add column if not exists cost_source text not null default 'portal_default';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_costs_cost_source_check') then
    alter table public.product_costs
      add constraint product_costs_cost_source_check check (cost_source in ('portal_default', 'manual', 'preferred', 'lowest'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'org_settings_default_cost_source_check') then
    alter table public.org_settings
      add constraint org_settings_default_cost_source_check check (
        store_default_cost_source in ('manual', 'preferred', 'lowest')
        and business_default_cost_source in ('manual', 'preferred', 'lowest')
        and corporate_default_cost_source in ('manual', 'preferred', 'lowest'));
  end if;
end $$;

comment on column public.product_costs.cost_source is
  'portal_default = the portal rule''s default_cost_source. manual = supplier_cost. preferred = pinned preferred offer when eligible, else supplier_cost. lowest = best eligible offer (pinned preferred wins), else supplier_cost. A product value other than portal_default applies on every portal.';
comment on column public.org_settings.store_default_cost_source is 'Cost source for Retail (store) prices of products set to portal_default: manual | preferred | lowest.';
comment on column public.org_settings.business_default_cost_source is 'Cost source for business prices of products set to portal_default: manual | preferred | lowest.';
comment on column public.org_settings.corporate_default_cost_source is 'Cost source for corporate prices of products set to portal_default: manual | preferred | lowest.';

-- Which portal a company's quotes and orders price on.
create or replace function public.company_pricing_portal(p_company_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when (select c.account_type from public.companies c where c.id = p_company_id) = 'business'
              then 'business' else 'corporate' end;
$$;
revoke all on function public.company_pricing_portal(uuid) from public, anon, authenticated;
grant execute on function public.company_pricing_portal(uuid) to service_role;

create or replace function public.effective_product_cost(p_product_id uuid, p_quantity integer default null, p_portal text default null)
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

  -- No portal (or an unknown one) means the manual cost for portal_default products.
  v_source := coalesce(v_source, 'portal_default');
  if v_source = 'portal_default' then
    select case p_portal
             when 'store' then s.store_default_cost_source
             when 'business' then s.business_default_cost_source
             when 'corporate' then s.corporate_default_cost_source
           end
      into v_source
    from public.org_settings s
    limit 1;
    v_source := coalesce(v_source, 'manual');
  end if;
  if v_source not in ('preferred', 'lowest') then
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

comment on function public.effective_product_cost(uuid, integer, text) is
  'The one cost every sell price and order cost is built from. Mirrored by src/lib/pricing/cost-basis.ts.';

revoke all on function public.effective_product_cost(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.effective_product_cost(uuid, integer, text) to service_role;

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

commit;
