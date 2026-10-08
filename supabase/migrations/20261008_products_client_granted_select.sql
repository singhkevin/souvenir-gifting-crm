-- Already applied in production. Idempotent: safe to re-run.
drop policy if exists products_client_granted_select on public.products;
create policy products_client_granted_select on public.products for select to authenticated using (
  status = 'active'::product_status
  and catalogue_access = 'selected'
  and exists (select 1 from public.company_product_access a where a.product_id = products.id and a.company_id = public.client_company_id())
  and not exists (select 1 from public.company_product_exclusions e where e.product_id = products.id and e.company_id = public.client_company_id())
);
