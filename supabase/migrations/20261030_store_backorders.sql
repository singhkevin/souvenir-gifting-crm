-- Retail backorders and back-in-stock alerts.
-- Out-of-stock store lines become one arrangement request, linked to a requirement
-- so staff can quote them from the existing pipeline. In-stock checkout is unchanged:
-- this file does not replace place_direct_order.
-- A stock increase enqueues a job. The app sends each pending alert once.
-- Not applied. Apply after step 60 in APPLY_ORDER.md.
-- Rollback: supabase/rollbacks/20261030_store_backorders_rollback.sql

begin;

alter table public.requirements drop constraint if exists requirements_source_check;
alter table public.requirements
  add constraint requirements_source_check
  check (source in ('staff', 'corporate_portal', 'business_portal', 'website', 'store_backorder'));

comment on column public.requirements.source is
  'staff, corporate_portal, business_portal, website, or store_backorder.';

create table if not exists public.store_backorder_requests (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid references public.requirements (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  company_name text,
  needed_by date,
  note text,
  notify_opt_in boolean not null default false,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined', 'converted')),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.store_backorder_requests is
  'Retail arrangement requests for units that were not in stock. Staff accept, decline, or convert to a quotation.';

create index if not exists store_backorder_requests_status_idx
  on public.store_backorder_requests (status, created_at desc);

create table if not exists public.store_backorder_lines (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.store_backorder_requests (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity >= 1 and quantity <= 100000),
  product_name text not null,
  sku text,
  unique (request_id, product_id)
);

comment on table public.store_backorder_lines is
  'Products and quantities on a retail arrangement request.';

create table if not exists public.store_stock_alerts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  backorder_request_id uuid references public.store_backorder_requests (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.store_stock_alerts is
  'One pending email per product and address. Marked sent after the back-in-stock email goes out.';

create unique index if not exists store_stock_alerts_pending_email
  on public.store_stock_alerts (product_id, lower(email))
  where status = 'pending';

create index if not exists store_stock_alerts_product_pending_idx
  on public.store_stock_alerts (product_id)
  where status = 'pending';

create table if not exists public.store_stock_alert_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  previous_qty integer not null,
  next_qty integer not null,
  status text not null default 'pending' check (status in ('pending', 'done')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

comment on table public.store_stock_alert_jobs is
  'Queue filled when products.stock_qty increases and a pending alert exists. The app sends the email.';

create index if not exists store_stock_alert_jobs_pending_idx
  on public.store_stock_alert_jobs (created_at)
  where status = 'pending';

alter table public.store_backorder_requests enable row level security;
alter table public.store_backorder_lines enable row level security;
alter table public.store_stock_alerts enable row level security;
alter table public.store_stock_alert_jobs enable row level security;

revoke all on table public.store_backorder_requests from public, anon, authenticated;
revoke all on table public.store_backorder_lines from public, anon, authenticated;
revoke all on table public.store_stock_alerts from public, anon, authenticated;
revoke all on table public.store_stock_alert_jobs from public, anon, authenticated;

grant select, update on table public.store_backorder_requests to authenticated;
grant select on table public.store_backorder_lines to authenticated;
grant select on table public.store_stock_alerts to authenticated;
grant all on table public.store_backorder_requests to service_role;
grant all on table public.store_backorder_lines to service_role;
grant all on table public.store_stock_alerts to service_role;
grant all on table public.store_stock_alert_jobs to service_role;

drop policy if exists store_backorder_requests_staff_select on public.store_backorder_requests;
create policy store_backorder_requests_staff_select
  on public.store_backorder_requests
  for select
  to authenticated
  using (
    public.has_any_role(array['admin', 'sales', 'operations', 'management']::public.app_role[])
  );

drop policy if exists store_backorder_requests_staff_update on public.store_backorder_requests;
create policy store_backorder_requests_staff_update
  on public.store_backorder_requests
  for update
  to authenticated
  using (
    public.has_any_role(array['admin', 'sales', 'operations', 'management']::public.app_role[])
  )
  with check (
    public.has_any_role(array['admin', 'sales', 'operations', 'management']::public.app_role[])
  );

drop policy if exists store_backorder_lines_staff_select on public.store_backorder_lines;
create policy store_backorder_lines_staff_select
  on public.store_backorder_lines
  for select
  to authenticated
  using (
    public.has_any_role(array['admin', 'sales', 'operations', 'management']::public.app_role[])
  );

drop policy if exists store_stock_alerts_staff_select on public.store_stock_alerts;
create policy store_stock_alerts_staff_select
  on public.store_stock_alerts
  for select
  to authenticated
  using (
    public.has_any_role(array['admin', 'sales', 'operations', 'management']::public.app_role[])
  );

create or replace function public.enqueue_store_stock_alerts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(new.stock_qty, 0) > coalesce(old.stock_qty, 0)
     and exists (
       select 1
       from public.store_stock_alerts alert
       where alert.product_id = new.id
         and alert.status = 'pending'
     )
  then
    insert into public.store_stock_alert_jobs (product_id, previous_qty, next_qty)
    values (new.id, coalesce(old.stock_qty, 0), coalesce(new.stock_qty, 0));
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_store_stock_alerts() from public, anon, authenticated;

drop trigger if exists products_enqueue_store_stock_alerts on public.products;
create trigger products_enqueue_store_stock_alerts
  after update of stock_qty on public.products
  for each row
  execute function public.enqueue_store_stock_alerts();

commit;
