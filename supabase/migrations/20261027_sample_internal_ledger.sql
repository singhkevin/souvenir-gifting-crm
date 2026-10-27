-- Internal sample ledger.
-- Not applied. Do not run this against production from the agent.
--
-- sample_stock and sample_movements are staff CRM data. This enables RLS, drops any
-- existing policy (permissive policies are OR'd, so a public policy would stay open),
-- and allows only active staff to read. Sales, operations, and admin may write.
-- Retail, business, and company-portal roles are not in that list.
--
-- sample_holdings records how many pieces each client company or team member holds,
-- so a return can be checked against that balance.
-- Rollback: supabase/rollbacks/20261027_sample_internal_ledger_rollback.sql
-- The rollback removes the holdings table and the new columns. It does not reopen
-- sample stock to non-staff.

begin;

alter table public.sample_movements
  add column if not exists holder_profile_id uuid;

alter table public.sample_movements
  add column if not exists condition text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sample_movements_holder_profile_id_fkey'
      and conrelid = 'public.sample_movements'::regclass
  ) then
    alter table public.sample_movements
      add constraint sample_movements_holder_profile_id_fkey
      foreign key (holder_profile_id) references public.profiles (id) on delete set null;
  end if;
end $$;

alter table public.sample_movements drop constraint if exists sample_movements_condition_len;
alter table public.sample_movements
  add constraint sample_movements_condition_len
  check (condition is null or char_length(condition) <= 500);

create table if not exists public.sample_holdings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid references public.companies (id) on delete restrict,
  profile_id uuid references public.profiles (id) on delete restrict,
  quantity integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.sample_holdings drop constraint if exists sample_holdings_quantity_check;
alter table public.sample_holdings
  add constraint sample_holdings_quantity_check check (quantity >= 0);

alter table public.sample_holdings drop constraint if exists sample_holdings_one_party;
alter table public.sample_holdings
  add constraint sample_holdings_one_party check (
    (company_id is not null and profile_id is null)
    or (company_id is null and profile_id is not null)
  );

create unique index if not exists sample_holdings_company_uidx
  on public.sample_holdings (product_id, company_id)
  where company_id is not null;

create unique index if not exists sample_holdings_profile_uidx
  on public.sample_holdings (product_id, profile_id)
  where profile_id is not null;

create index if not exists sample_holdings_product_idx
  on public.sample_holdings (product_id);

create index if not exists sample_movements_holder_profile_idx
  on public.sample_movements (holder_profile_id);

-- One row per client that the movement history already explains. Does not overwrite later edits.
insert into public.sample_holdings (product_id, company_id, quantity)
select nets.product_id, nets.company_id, nets.quantity
from (
  select
    m.product_id,
    m.company_id,
    sum(
      case
        when m.to_holder = 'client' then m.quantity
        when m.from_holder = 'client' then -m.quantity
        else 0
      end
    )::integer as quantity
  from public.sample_movements m
  where m.company_id is not null
    and (m.to_holder = 'client' or m.from_holder = 'client')
  group by m.product_id, m.company_id
  having sum(
    case
      when m.to_holder = 'client' then m.quantity
      when m.from_holder = 'client' then -m.quantity
      else 0
    end
  ) > 0
) nets
where not exists (
  select 1
  from public.sample_holdings h
  where h.product_id = nets.product_id
    and h.company_id = nets.company_id
);

create or replace function public.is_sample_reader()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active is true
      and p.role in ('admin', 'sales', 'operations', 'accounts', 'management')
  );
$$;

create or replace function public.is_sample_writer()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active is true
      and p.role in ('admin', 'sales', 'operations')
  );
$$;

revoke all on function public.is_sample_reader() from public, anon, authenticated;
revoke all on function public.is_sample_writer() from public, anon, authenticated;
grant execute on function public.is_sample_reader() to authenticated;
grant execute on function public.is_sample_writer() to authenticated;

alter table public.sample_stock enable row level security;
alter table public.sample_movements enable row level security;
alter table public.sample_holdings enable row level security;

do $$
declare r record;
begin
  for r in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('sample_stock', 'sample_movements', 'sample_holdings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy sample_stock_select_staff on public.sample_stock
  for select to authenticated
  using ((select public.is_sample_reader()));

create policy sample_stock_insert_staff on public.sample_stock
  for insert to authenticated
  with check ((select public.is_sample_writer()));

create policy sample_stock_update_staff on public.sample_stock
  for update to authenticated
  using ((select public.is_sample_writer()))
  with check ((select public.is_sample_writer()));

create policy sample_movements_select_staff on public.sample_movements
  for select to authenticated
  using ((select public.is_sample_reader()));

create policy sample_movements_insert_staff on public.sample_movements
  for insert to authenticated
  with check ((select public.is_sample_writer()));

create policy sample_holdings_select_staff on public.sample_holdings
  for select to authenticated
  using ((select public.is_sample_reader()));

create policy sample_holdings_insert_staff on public.sample_holdings
  for insert to authenticated
  with check ((select public.is_sample_writer()));

create policy sample_holdings_update_staff on public.sample_holdings
  for update to authenticated
  using ((select public.is_sample_writer()))
  with check ((select public.is_sample_writer()));

revoke all on table public.sample_stock from public, anon, authenticated;
revoke all on table public.sample_movements from public, anon, authenticated;
revoke all on table public.sample_holdings from public, anon, authenticated;

grant select, insert, update on table public.sample_stock to authenticated;
grant select, insert on table public.sample_movements to authenticated;
grant select, insert, update on table public.sample_holdings to authenticated;

-- A realtime publication would stream stock changes to any subscribed client.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sample_stock'
    ) then
      alter publication supabase_realtime drop table public.sample_stock;
    end if;
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sample_movements'
    ) then
      alter publication supabase_realtime drop table public.sample_movements;
    end if;
    if exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sample_holdings'
    ) then
      alter publication supabase_realtime drop table public.sample_holdings;
    end if;
  end if;
end $$;

-- Views bypass RLS unless they run as the invoker.
do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'v'
      and pg_get_viewdef(c.oid) ~* 'sample_(stock|movements|holdings)'
  loop
    execute format('alter view public.%I set (security_invoker = true)', r.relname);
    execute format('revoke all on table public.%I from public, anon', r.relname);
  end loop;
end $$;

comment on table public.sample_holdings is
  'Physical sample custody for the staff CRM. One client company or one team member per row. Not for the retail store, business portal, or company portals.';
comment on column public.sample_movements.holder_profile_id is
  'Team member who received the sample, or the team member it left.';
comment on column public.sample_movements.condition is
  'Condition noted when a sample is received back into the office.';

commit;
