-- Samples stay inside the staff CRM.
-- Do not apply from the agent. Apply after 20261023c_role_active_checks.sql.
--
-- 1. sample_stock and sample_movements are readable and writable only by active
--    staff (admin, sales, operations, accounts, management). A restrictive policy
--    is AND-ed with any older permissive policy, so a leftover "using (true)"
--    cannot leak the ledger to anon, clients, business users, or gift employees.
-- 2. sample_balances records how many pieces each client company or team member
--    holds, backfilled from sample_movements. Receive into Office checks this.
-- 3. sample_movements.holder_profile_id names the team member on a send or return.
-- 4. Products with sample_only are removed from the retail store, the Business
--    portal, client portals, and shared catalog reads. Staff still see them.
-- 5. Existing sample_only products with no sample_stock row are seeded so they
--    show under /crm/samples. in_office starts at stock_qty. A receipt movement
--    is written when that quantity is above zero.
--
-- Order lifecycle functions are not changed.
-- Rollback: supabase/rollbacks/20261027_samples_internal_rollback.sql

begin;

-- Staff check inlined in policies. No new security-definer function in public.
-- role is app_role; the text cast keeps the policy valid if a label is compared.

alter table public.sample_stock enable row level security;
alter table public.sample_movements enable row level security;

revoke all on table public.sample_stock from anon;
revoke all on table public.sample_movements from anon;
grant select, insert, update, delete on table public.sample_stock to authenticated;
grant select, insert, update, delete on table public.sample_movements to authenticated;

drop policy if exists sample_stock_staff_rw on public.sample_stock;
create policy sample_stock_staff_rw on public.sample_stock
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

drop policy if exists sample_stock_staff_only on public.sample_stock;
create policy sample_stock_staff_only on public.sample_stock
  as restrictive
  for all to public
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

drop policy if exists sample_movements_staff_rw on public.sample_movements;
create policy sample_movements_staff_rw on public.sample_movements
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

drop policy if exists sample_movements_staff_only on public.sample_movements;
create policy sample_movements_staff_only on public.sample_movements
  as restrictive
  for all to public
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

alter table public.sample_movements
  add column if not exists holder_profile_id uuid references public.profiles (id) on delete set null;

comment on column public.sample_movements.holder_profile_id is
  'Team member this piece was sent to or returned from. Client sends use company_id.';

create index if not exists sample_movements_holder_profile_idx
  on public.sample_movements (holder_profile_id);

create table if not exists public.sample_balances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sample_balances_one_holder check (
    (company_id is not null and profile_id is null)
    or (company_id is null and profile_id is not null)
  )
);

comment on table public.sample_balances is
  'Pieces of one sample currently with one client company or one team member. Staff CRM only.';

create unique index if not exists sample_balances_company_uidx
  on public.sample_balances (product_id, company_id)
  where company_id is not null;

create unique index if not exists sample_balances_profile_uidx
  on public.sample_balances (product_id, profile_id)
  where profile_id is not null;

alter table public.sample_balances enable row level security;

revoke all on table public.sample_balances from anon;
grant select, insert, update, delete on table public.sample_balances to authenticated;

drop policy if exists sample_balances_staff_rw on public.sample_balances;
create policy sample_balances_staff_rw on public.sample_balances
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

drop policy if exists sample_balances_staff_only on public.sample_balances;
create policy sample_balances_staff_only on public.sample_balances
  as restrictive
  for all to public
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

insert into public.sample_balances (product_id, company_id, quantity)
select m.product_id, m.company_id, m.qty
from (
  select product_id,
         company_id,
         sum(
           case
             when to_holder = 'client' then quantity
             when from_holder = 'client' then -quantity
             else 0
           end
         )::integer as qty
  from public.sample_movements
  where company_id is not null
    and (to_holder = 'client' or from_holder = 'client')
  group by product_id, company_id
) m
where m.qty > 0
  and not exists (
    select 1
    from public.sample_balances b
    where b.product_id = m.product_id
      and b.company_id = m.company_id
  );

-- Existing sample-only products that never reached Samples.
with seeded as (
  insert into public.sample_stock (product_id, in_office, with_team, with_client, pending_supplier, unit_cost)
  select p.id,
         greatest(coalesce(p.stock_qty, 0), 0),
         0,
         0,
         0,
         coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), 0)
  from public.products p
  where coalesce(p.sample_only, false)
    and not exists (select 1 from public.sample_stock s where s.product_id = p.id)
  returning product_id, in_office, unit_cost
)
insert into public.sample_movements (product_id, quantity, from_holder, to_holder, cost, note)
select product_id, in_office, 'supplier', 'office', unit_cost, 'Initial sample receipt'
from seeded
where in_office > 0;

-- Hide sample-only products from non-staff reads of the products table.
-- Permissive channel policies stay as they are. This one is AND-ed with them.
drop policy if exists products_sample_only_internal on public.products;
create policy products_sample_only_internal on public.products
  as restrictive
  for select to public
  using (
    coalesce(sample_only, false) = false
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role::text in ('admin', 'sales', 'operations', 'accounts', 'management')
    )
  );

-- client_products and portal_catalogue run as the view owner, so the policy above
-- does not filter them. Append the same predicate to the live view bodies.
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
    if position('p.status' in v_def) = 0 then
      raise exception '% has no p.status filter to extend', v_name;
    end if;
    v_def := rtrim(v_def);
    if right(v_def, 1) = ';' then
      v_def := left(v_def, length(v_def) - 1);
    end if;
    execute format('create or replace view public.%I as ', v_name)
      || v_def
      || ' and coalesce(p.sample_only, false) = false';
  end loop;
end
$views$;

-- Shared catalog reads are security definer and bypass products RLS.
do $catalog$
declare
  v_def text;
  v_old text := 'p.status = ''active''';
  v_hits integer;
begin
  if to_regprocedure('public.get_shared_catalog(text)') is null then
    return;
  end if;
  v_def := pg_get_functiondef('public.get_shared_catalog(text)'::regprocedure);
  if position('sample_only' in v_def) > 0 then
    return;
  end if;
  v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_hits <> 1 then
    raise exception 'get_shared_catalog: expected 1 product status check, found %', v_hits;
  end if;
  execute replace(v_def, v_old, v_old || ' and coalesce(p.sample_only, false) = false');
end
$catalog$;

commit;
