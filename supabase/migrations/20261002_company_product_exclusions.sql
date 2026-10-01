-- Per-company catalogue exclusions.
--
-- Extends the existing whitelist model:
--   * catalogue_access = 'all'  → every company sees it, unless excluded here
--   * catalogue_access = 'selected' + company_product_access → whitelist
--   * company_product_exclusions → hide a product from one company only
--
-- Do not apply from the agent; deliver for Hostinger/ops.

begin;

-- 1. Exclusions table
create table if not exists public.company_product_exclusions (
  company_id uuid not null references public.companies (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (company_id, product_id)
);

create index if not exists company_product_exclusions_product_id_idx
  on public.company_product_exclusions (product_id);

comment on table public.company_product_exclusions is
  'Per-company hides for catalogue products. Subtracted from client_products after all/selected grant rules.';

alter table public.company_product_exclusions enable row level security;

grant select on public.company_product_exclusions to authenticated;
grant insert, update, delete on public.company_product_exclusions to authenticated;

-- Staff can read (company catalogue browser); writes are admin-only (matches CPA).
drop policy if exists cpe_select on public.company_product_exclusions;
create policy cpe_select on public.company_product_exclusions
  for select
  using (public.can_management_read() or public.can_crm());

drop policy if exists cpe_write on public.company_product_exclusions;
create policy cpe_write on public.company_product_exclusions
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- 2. Audit (mirrors company_product_access)
create or replace function public.write_catalogue_exclusion_audit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.company_product_exclusions;
  v_sku text;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  select sku into v_sku from public.products where id = v_row.product_id;

  insert into public.audit_logs (user_id, action, entity, entity_id, previous_value, new_value)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'catalogue_client_hidden' else 'catalogue_client_shown' end,
    'company_product_exclusions',
    v_row.product_id,
    case when tg_op = 'DELETE'
      then jsonb_build_object('company_id', old.company_id, 'product_id', old.product_id, 'sku', v_sku)
    end,
    case when tg_op = 'INSERT'
      then jsonb_build_object('company_id', new.company_id, 'product_id', new.product_id, 'sku', v_sku)
    end
  );
  return v_row;
end;
$$;

drop trigger if exists audit_company_product_exclusions on public.company_product_exclusions;
create trigger audit_company_product_exclusions
  after insert or delete on public.company_product_exclusions
  for each row execute function public.write_catalogue_exclusion_audit();

-- 3. Recreate client_products with exclusion filter (preserves pricing columns).
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

commit;
