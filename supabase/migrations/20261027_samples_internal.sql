-- Samples stay inside the staff CRM.
-- Not applied. Do not run this against production from the agent.
-- Rollback: supabase/rollbacks/20261027_samples_internal_rollback.sql
--
-- Depends on products.sample_only (20261018) and products.show_in_store /
-- show_in_business (20261022_channel_visibility.sql).
--
-- 1. sample_only products are forced off the retail store, the business portal,
--    and corporate catalogues.
-- 2. sample_stock, sample_movements, and the new per-holder balances are readable
--    and writable only by staff. Client, business, gift, and anonymous roles cannot
--    select them. Existing policies on the two sample tables are replaced because
--    a permissive policy would keep the rows visible.
-- 3. Existing sample_only products get a sample_stock row if they do not have one,
--    and client balances are rebuilt from movements that named a company.

do $pre$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'show_in_store'
  ) then
    raise exception 'Apply supabase/migrations/20261022_channel_visibility.sql before 20261027_samples_internal.sql';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'sample_only'
  ) then
    raise exception 'Apply supabase/migrations/20261018_registration_pricing_samples.sql before 20261027_samples_internal.sql';
  end if;
end
$pre$;

create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $protect$
begin
  if tg_op = 'UPDATE' and (
    new.catalogue_access is distinct from old.catalogue_access
    or new.visibility is distinct from old.visibility
    or new.show_in_store is distinct from old.show_in_store
    or new.show_in_business is distinct from old.show_in_business
  ) then
    if not public.is_admin() then
      -- Sales can mark a product sample-only. That save is allowed only when it
      -- also takes the product off every public channel.
      if not (
        coalesce(new.sample_only, false)
        and coalesce(new.show_in_store, false) = false
        and coalesce(new.show_in_business, false) = false
        and new.catalogue_access = 'none'
        and new.visibility = 'internal_only'
      ) then
        raise exception 'Only admin can change product catalogue visibility';
      end if;
    end if;
  end if;
  return new;
end;
$protect$;

create or replace function public.enforce_sample_only_internal()
returns trigger
language plpgsql
as $enforce$
begin
  if coalesce(new.sample_only, false) then
    new.show_in_store := false;
    new.show_in_business := false;
    new.catalogue_access := 'none';
    new.visibility := 'internal_only';
  end if;
  return new;
end;
$enforce$;

drop trigger if exists enforce_sample_only_internal on public.products;
create trigger enforce_sample_only_internal
  before insert or update on public.products
  for each row execute function public.enforce_sample_only_internal();

do $backfill$
begin
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'products' and t.tgname = 'products_updated_at'
  ) then
    execute 'alter table public.products disable trigger products_updated_at';
  end if;
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'products' and t.tgname = 'audit_products'
  ) then
    execute 'alter table public.products disable trigger audit_products';
  end if;

  update public.products
  set show_in_store = false,
      show_in_business = false,
      catalogue_access = 'none',
      visibility = 'internal_only'
  where sample_only = true
    and (
      show_in_store
      or show_in_business
      or catalogue_access is distinct from 'none'
      or visibility is distinct from 'internal_only'
    );

  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'products' and t.tgname = 'products_updated_at'
  ) then
    execute 'alter table public.products enable trigger products_updated_at';
  end if;
  if exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'products' and t.tgname = 'audit_products'
  ) then
    execute 'alter table public.products enable trigger audit_products';
  end if;
end
$backfill$;

insert into public.sample_stock (product_id, in_office, with_team, with_client, pending_supplier, unit_cost)
select p.id, 0, 0, 0, 0, 0
from public.products p
where p.sample_only = true
  and not exists (select 1 from public.sample_stock s where s.product_id = p.id);

alter table public.sample_movements
  add column if not exists holder_profile_id uuid references public.profiles(id);

create index if not exists sample_movements_holder_profile_idx
  on public.sample_movements (holder_profile_id)
  where holder_profile_id is not null;

create table if not exists public.sample_holder_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  company_id uuid references public.companies(id) on delete restrict,
  holder_profile_id uuid references public.profiles(id) on delete restrict,
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint sample_holder_balances_quantity_check check (quantity >= 0),
  constraint sample_holder_balances_party_check check (
    (company_id is not null and holder_profile_id is null)
    or (company_id is null and holder_profile_id is not null)
  )
);

create unique index if not exists sample_holder_balances_company_key
  on public.sample_holder_balances (product_id, company_id)
  where company_id is not null;

create unique index if not exists sample_holder_balances_profile_key
  on public.sample_holder_balances (product_id, holder_profile_id)
  where holder_profile_id is not null;

comment on table public.sample_holder_balances is
  'Pieces of a sample currently with one client company or one team member. Staff CRM only.';

insert into public.sample_holder_balances (product_id, company_id, quantity)
select product_id, company_id, quantity
from (
  select m.product_id,
         m.company_id,
         sum(case
           when m.to_holder = 'client' then m.quantity
           when m.from_holder = 'client' then -m.quantity
           else 0
         end)::integer as quantity
  from public.sample_movements m
  where m.company_id is not null
  group by m.product_id, m.company_id
) totals
where quantity > 0
  and not exists (
    select 1 from public.sample_holder_balances b
    where b.product_id = totals.product_id and b.company_id = totals.company_id
  );

-- Staff only. Drop every previous policy first: permissive policies are OR-ed,
-- so an old USING (true) would keep clients and anon able to read the rows.
do $drop_sample_policies$
declare
  r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sample_stock', 'sample_movements', 'sample_holder_balances')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$drop_sample_policies$;

alter table public.sample_stock enable row level security;
alter table public.sample_movements enable row level security;
alter table public.sample_holder_balances enable row level security;

revoke all on table public.sample_stock from public, anon;
revoke all on table public.sample_movements from public, anon;
revoke all on table public.sample_holder_balances from public, anon;

grant select, insert, update, delete on table public.sample_stock to authenticated;
grant select, insert, update, delete on table public.sample_movements to authenticated;
grant select, insert, update, delete on table public.sample_holder_balances to authenticated;

do $sample_policies$
declare
  t text;
begin
  foreach t in array array['sample_stock', 'sample_movements', 'sample_holder_balances']
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.has_any_role(array[''admin'',''sales'',''operations'',''accounts'',''management'']::public.app_role[]))',
      t || '_staff_select',
      t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_any_role(array[''admin'',''sales'',''operations'']::public.app_role[])) with check (public.has_any_role(array[''admin'',''sales'',''operations'']::public.app_role[]))',
      t || '_staff_write',
      t
    );
  end loop;
end
$sample_policies$;

-- Public and client product reads exclude sample-only rows. Staff policies that
-- mention an internal role helper are left unchanged so the CRM can still open them.
do $product_policies$
declare
  r record;
  new_qual text;
begin
  for r in
    select pol.polname as policy_name,
           pg_get_expr(pol.polqual, pol.polrelid) as qual
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'products'
      and pol.polcmd = 'r'
      and pol.polqual is not null
  loop
    if r.qual ilike '%sample_only%' then
      continue;
    end if;
    if r.qual ~* 'is_internal|is_admin|has_any_role|can_crm|can_ops|can_finance|can_management|is_pricing_staff|current_role' then
      continue;
    end if;
    if r.qual !~* 'catalogue_access|show_in_store|show_in_business|is_client|is_business|client_company_id|business_company_id' then
      continue;
    end if;
    new_qual := '(' || r.qual || ') and coalesce(sample_only, false) = false';
    execute 'alter policy ' || quote_ident(r.policy_name) || ' on public.products using (' || new_qual || ')';
  end loop;
end
$product_policies$;

-- client_products and portal_catalogue bypass product RLS. Add the same exclusion
-- to whatever definition is live, without rewriting the price expression.
do $views$
declare
  v_name text;
  v_def text;
begin
  foreach v_name in array array['client_products', 'portal_catalogue']
  loop
    if to_regclass('public.' || v_name) is null then
      continue;
    end if;
    v_def := pg_get_viewdef(format('public.%I', v_name)::regclass, true);
    if position('sample_only' in v_def) > 0 then
      continue;
    end if;
    -- Match the status comparison in WHERE, not a selected p.status column
    -- (portal_catalogue lists p.status before the filter).
    if v_def ~* 'p\.status\s*=' then
      v_def := regexp_replace(v_def, 'p\.status\s*=', 'coalesce(p.sample_only, false) = false AND p.status =', 'i');
    elsif v_def ~* 'products\.status\s*=' then
      v_def := regexp_replace(v_def, 'products\.status\s*=', 'coalesce(products.sample_only, false) = false AND products.status =', 'i');
    else
      raise exception 'public.% has no product status predicate to exclude sample_only', v_name;
    end if;
    execute 'create or replace view public.' || quote_ident(v_name) || ' as ' || rtrim(v_def, E' \n\r;');
  end loop;
end
$views$;
