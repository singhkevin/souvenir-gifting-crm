-- Rollback for 20261005_supplier_offers.sql
-- Restores client_products to the 20261002 definition (sell price from products.supplier_cost).

begin;

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
  )
  and not exists (
    select 1
    from public.company_product_exclusions cpe
    where cpe.product_id = p.id
      and cpe.company_id = public.client_company_id()
  );

comment on view public.client_products is
  'Client-safe catalogue with company-aware sell price. Applies all/selected grants minus per-company exclusions. No cost, supplier, or margin columns.';

revoke all on public.client_products from anon;
grant select on public.client_products to authenticated;

revoke all on function public.best_supplier_cost(uuid, integer) from public, anon, authenticated;
drop function if exists public.best_supplier_cost(uuid, integer);

drop table if exists public.quotation_item_costs;
drop table if exists public.product_supplier_offers;

alter table public.org_settings
  drop column if exists best_cost_require_in_stock,
  drop column if exists crm_use_best_cost,
  drop column if exists crm_show_sell_price,
  drop column if exists portal_use_best_cost,
  drop column if exists portal_show_sell_price,
  drop column if exists microsite_use_best_cost,
  drop column if exists microsite_show_sell_price,
  drop column if exists store_use_best_cost,
  drop column if exists store_show_sell_price;

revoke all on function public.is_pricing_staff() from public, authenticated;
drop function if exists public.is_pricing_staff();

commit;
