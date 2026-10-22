-- Rollback for 20261022_pricing_cost_basis.sql (step 1, schema only).
-- Roll back the cutover first if it was applied (supabase/rollbacks/20261022_pricing_cost_basis_cutover_rollback.sql).
-- Drops the cost_source column, portal_product_margins, effective_product_cost and the source/portal
-- columns. Manual per-product portal margins and cost_source choices are lost.

begin;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_freeze_product_price') then
    raise exception 'Roll back 20261022_pricing_cost_basis_cutover.sql first';
  end if;
end $$;

alter table public.company_product_prices drop constraint if exists company_product_prices_portal_check;
alter table public.company_product_prices drop constraint if exists company_product_prices_source_check;
alter table public.portal_product_prices drop constraint if exists portal_product_prices_source_check;
alter table public.company_product_prices drop column if exists portal;
alter table public.company_product_prices drop column if exists source;
alter table public.portal_product_prices drop column if exists source;

drop table if exists public.portal_product_margins;
drop function if exists public.effective_product_cost(uuid, integer, text);
drop function if exists public.company_pricing_portal(uuid);

alter table public.product_costs drop constraint if exists product_costs_cost_source_check;
alter table public.product_costs drop column if exists cost_source;

alter table public.org_settings drop constraint if exists org_settings_default_cost_source_check;
alter table public.org_settings
  drop column if exists store_default_cost_source,
  drop column if exists business_default_cost_source,
  drop column if exists corporate_default_cost_source;

commit;
