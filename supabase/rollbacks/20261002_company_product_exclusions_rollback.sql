-- Rollback for 20261002_company_product_exclusions.sql
-- Restores client_products to the pre-exclusion definition from 20260922_pricing_margins_domains.sql

begin;

drop trigger if exists audit_company_product_exclusions on public.company_product_exclusions;
drop function if exists public.write_catalogue_exclusion_audit();

drop policy if exists cpe_write on public.company_product_exclusions;
drop policy if exists cpe_select on public.company_product_exclusions;

revoke all on public.company_product_exclusions from authenticated;

drop table if exists public.company_product_exclusions;

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

commit;
