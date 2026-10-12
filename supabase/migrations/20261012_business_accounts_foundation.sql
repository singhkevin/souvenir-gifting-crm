-- Business accounts: account type, verification, helpers, and additive SELECT policies.
-- Requires 20261012_business_role_enum.sql to be committed first.
-- Does not change staff or corporate client policies.

alter table public.companies
  add column if not exists account_type text not null default 'corporate',
  add column if not exists business_verification text,
  add column if not exists business_verified_at timestamptz,
  add column if not exists business_verified_by uuid references public.profiles (id);

alter table public.companies drop constraint if exists companies_account_type_check;
alter table public.companies
  add constraint companies_account_type_check
  check (account_type in ('corporate', 'business'));

alter table public.companies drop constraint if exists companies_business_verification_check;
alter table public.companies
  add constraint companies_business_verification_check
  check (
    business_verification is null
    or business_verification in ('unverified', 'verified', 'rejected')
  );

comment on column public.companies.account_type is
  'corporate (default) or business. Business rows are open B2B accounts, not corporate portal clients.';
comment on column public.companies.business_verification is
  'unverified, verified, or rejected. Null on corporate accounts.';

create or replace function public.is_business()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select role = 'business_user'
    from public.profiles
    where id = auth.uid()
      and is_active
  ), false);
$$;

create or replace function public.business_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.company_id
  from public.profiles p
  join public.companies c
    on c.id = p.company_id
   and c.account_type = 'business'
  where p.id = auth.uid()
    and p.role = 'business_user'
    and p.is_active;
$$;

revoke all on function public.is_business() from public;
revoke all on function public.business_company_id() from public;
grant execute on function public.is_business() to authenticated, service_role;
grant execute on function public.business_company_id() to authenticated, service_role;

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.requirements enable row level security;
alter table public.requirement_products enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

drop policy if exists companies_select_business on public.companies;
create policy companies_select_business on public.companies
  for select to authenticated
  using (public.is_business() and id = public.business_company_id());

drop policy if exists contacts_select_business on public.contacts;
create policy contacts_select_business on public.contacts
  for select to authenticated
  using (public.is_business() and company_id = public.business_company_id());

drop policy if exists requirements_select_business on public.requirements;
create policy requirements_select_business on public.requirements
  for select to authenticated
  using (public.is_business() and company_id = public.business_company_id());

drop policy if exists requirement_products_select_business on public.requirement_products;
create policy requirement_products_select_business on public.requirement_products
  for select to authenticated
  using (
    public.is_business()
    and exists (
      select 1
      from public.requirements r
      where r.id = requirement_id
        and r.company_id = public.business_company_id()
    )
  );

drop policy if exists quotations_select_business on public.quotations;
create policy quotations_select_business on public.quotations
  for select to authenticated
  using (
    public.is_business()
    and company_id = public.business_company_id()
    and status in ('sent', 'viewed', 'accepted', 'rejected', 'expired')
  );

drop policy if exists quotation_items_select_business on public.quotation_items;
create policy quotation_items_select_business on public.quotation_items
  for select to authenticated
  using (
    public.is_business()
    and exists (
      select 1
      from public.quotations q
      where q.id = quotation_id
        and q.company_id = public.business_company_id()
        and q.status in ('sent', 'viewed', 'accepted', 'rejected', 'expired')
    )
  );

drop policy if exists orders_select_business on public.orders;
create policy orders_select_business on public.orders
  for select to authenticated
  using (
    public.is_business()
    and company_id = public.business_company_id()
    and quotation_id is not null
  );

drop policy if exists order_items_select_business on public.order_items;
create policy order_items_select_business on public.order_items
  for select to authenticated
  using (
    public.is_business()
    and exists (
      select 1
      from public.orders o
      where o.id = order_id
        and o.company_id = public.business_company_id()
        and o.quotation_id is not null
    )
  );

drop policy if exists notifications_select_business on public.notifications;
create policy notifications_select_business on public.notifications
  for select to authenticated
  using (
    public.is_business()
    and audience = 'client'
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists notifications_update_business on public.notifications;
create policy notifications_update_business on public.notifications
  for update to authenticated
  using (
    public.is_business()
    and audience = 'client'
    and (user_id is null or user_id = auth.uid())
  )
  with check (
    public.is_business()
    and audience = 'client'
    and (user_id is null or user_id = auth.uid())
  );
