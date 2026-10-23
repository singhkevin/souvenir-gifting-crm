-- Order lifecycle v2, step 2 of 2: line-level stages, purchase orders, print jobs,
-- runner jobs with count checks, deliveries with proof, partial delivery.
--
-- Apply AFTER 20261023_runner_role_enum.sql (separate transaction).
-- Additive: no column or table is dropped, no order or line is deleted.
-- orders.status stays and becomes a summary of the slowest product line, so every
-- existing screen, report and email keeps working.
-- Rollback: supabase/rollbacks/20261023_order_line_lifecycle_rollback.sql
-- Trial run: supabase/tests/order_line_lifecycle_check.sql (always raises, nothing kept).
--
-- SAFE WITH THE OLD APP: production may keep running the order-level code after this is
-- applied. advance_order_stage and client_decide_order_approval are NOT changed here; the
-- new app calls olc_hand_off_order and client_decide_branding_approval instead. Inserting a
-- line only recomputes the order stage once 'lifecycle_live' is on, and while it is off an
-- order stage changed by the old app moves its lines along (new columns only). The switch to
-- the new rules happens later in 20261023b_order_line_lifecycle_go_live.sql.

-- ---------------------------------------------------------------------------
-- A. Settings. Every key is a default chosen while Vishal's answers are pending.
-- ---------------------------------------------------------------------------
create table if not exists public.order_lifecycle_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.order_lifecycle_settings (id, settings)
values (true, jsonb_build_object(
  -- TODO(client): can the client approve branding before goods reach the printer?
  'early_branding_approval', true,
  -- TODO(client): on a short count, continue with what was counted and flag it ('continue'),
  -- or stop until procurement decides ('block').
  'short_count_policy', 'continue',
  -- TODO(client): is a receiver signature required for runner deliveries?
  'require_signature', true,
  -- TODO(client): is a seal / stamped challan photo required for runner deliveries?
  'require_seal_photo', false,
  -- TODO(client): may an order be delivered in parts?
  'allow_partial_delivery', true,
  -- TODO(client): which order sources need branding by default (staff can change per line).
  'branding_sources', jsonb_build_array('portal', 'microsite', 'crm'),
  -- TODO(client): which order sources ship from stock by default (skip sourcing).
  'stock_sources', jsonb_build_array('store'),
  -- TODO(client): raise the supplier payable when the PO is sent ('po_sent') or never automatically ('manual').
  'payable_on', 'po_sent',
  -- Off while production still runs the order-level app. Turned on by the go-live migration.
  'lifecycle_live', false
))
on conflict (id) do nothing;

create or replace function public.olc_setting(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select settings -> p_key from public.order_lifecycle_settings where id;
$$;

-- ---------------------------------------------------------------------------
-- B. Columns on existing tables (all nullable or defaulted).
-- ---------------------------------------------------------------------------
alter table public.order_items
  add column if not exists stage text not null default 'confirmed',
  add column if not exists needs_branding boolean not null default true,
  add column if not exists fulfil_source text,
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null,
  add column if not exists supplier_offer_id uuid references public.product_supplier_offers(id) on delete set null,
  add column if not exists printing_vendor_id uuid references public.printing_vendors(id) on delete set null,
  add column if not exists unit_cost numeric(12,2),
  add column if not exists qty_delivered integer not null default 0,
  add column if not exists count_issue text,
  add column if not exists stage_updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_stage_check') then
    alter table public.order_items add constraint order_items_stage_check check (stage in (
      'confirmed', 'sourcing', 'supplier_pickup', 'to_printer', 'at_printer', 'printing',
      'printer_pickup', 'packing', 'out_for_delivery', 'delivered', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_fulfil_source_check') then
    alter table public.order_items add constraint order_items_fulfil_source_check
      check (fulfil_source is null or fulfil_source in ('stock', 'supplier'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_qty_delivered_check') then
    alter table public.order_items add constraint order_items_qty_delivered_check
      check (qty_delivered >= 0);
  end if;
end $$;

create index if not exists order_items_stage_idx on public.order_items (stage);

alter table public.mockups
  add column if not exists order_item_id uuid references public.order_items(id) on delete set null,
  add column if not exists version integer not null default 1;

-- Order status gains 'partly_delivered'.
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'created', 'procurement', 'mockup', 'client_approval', 'production', 'packaging_qc',
  'dispatched', 'partly_delivered', 'delivered', 'cancelled'));
alter table public.order_status_history drop constraint if exists order_status_history_from_status_check;
alter table public.order_status_history add constraint order_status_history_from_status_check check (
  from_status is null or from_status in ('created', 'procurement', 'mockup', 'client_approval', 'production',
  'packaging_qc', 'dispatched', 'partly_delivered', 'delivered', 'cancelled'));
alter table public.order_status_history drop constraint if exists order_status_history_to_status_check;
alter table public.order_status_history add constraint order_status_history_to_status_check check (
  to_status is null or to_status in ('created', 'procurement', 'mockup', 'client_approval', 'production',
  'packaging_qc', 'dispatched', 'partly_delivered', 'delivered', 'cancelled'));

-- Line-level history (orders keep order_status_history).
create table if not exists public.order_item_stage_history (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by uuid references public.profiles(id),
  note text,
  changed_at timestamptz not null default now()
);
create index if not exists order_item_stage_history_order_idx on public.order_item_stage_history (order_id, changed_at);

-- ---------------------------------------------------------------------------
-- C. New tables.
-- ---------------------------------------------------------------------------
create sequence if not exists public.purchase_order_seq;

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  order_id uuid not null references public.orders(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft' check (status in ('draft', 'sent', 'ready', 'collected', 'cancelled')),
  expected_date date,
  sent_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists purchase_orders_order_idx on public.purchase_orders (order_id);

create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity >= 1),
  unit_cost numeric(12,2),
  unique (purchase_order_id, order_item_id)
);

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  printing_vendor_id uuid references public.printing_vendors(id),
  status text not null default 'pending' check (status in ('pending', 'go_ahead', 'ready', 'collected', 'cancelled')),
  go_ahead_at timestamptz,
  go_ahead_by uuid references public.profiles(id),
  expected_ready_date date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print_jobs_order_idx on public.print_jobs (order_id);

create table if not exists public.print_job_lines (
  id uuid primary key default gen_random_uuid(),
  print_job_id uuid not null references public.print_jobs(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity >= 0),
  unique (print_job_id, order_item_id)
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null check (method in ('runner', 'courier')),
  courier_partner_id uuid references public.courier_partners(id),
  tracking_number text,
  status text not null default 'out' check (status in ('out', 'delivered', 'partly_delivered', 'failed', 'cancelled')),
  receiver_name text,
  receiver_phone text,
  signature_path text,
  seal_photo_path text,
  pod_path text,
  delivered_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id),
  completed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deliveries_order_idx on public.deliveries (order_id);

create table if not exists public.delivery_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  qty_sent integer not null check (qty_sent >= 1),
  qty_delivered integer check (qty_delivered >= 0),
  short_qty integer not null default 0 check (short_qty >= 0),
  damaged_qty integer not null default 0 check (damaged_qty >= 0),
  unique (delivery_id, order_item_id)
);

create table if not exists public.runner_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  kind text not null check (kind in ('supplier_pickup', 'to_printer', 'printer_pickup', 'delivery')),
  status text not null default 'open' check (status in ('open', 'assigned', 'in_progress', 'done', 'cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  scheduled_for date,
  from_label text,
  to_label text,
  address text,
  contact_phone text,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  print_job_id uuid references public.print_jobs(id) on delete set null,
  delivery_id uuid references public.deliveries(id) on delete set null,
  notes text,
  photo_path text,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists runner_jobs_assignee_idx on public.runner_jobs (assigned_to, status);
create index if not exists runner_jobs_order_idx on public.runner_jobs (order_id);

create table if not exists public.runner_job_lines (
  id uuid primary key default gen_random_uuid(),
  runner_job_id uuid not null references public.runner_jobs(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  expected_qty integer not null check (expected_qty >= 0),
  counted_qty integer check (counted_qty >= 0),
  damaged_qty integer not null default 0 check (damaged_qty >= 0),
  short_qty integer not null default 0 check (short_qty >= 0),
  note text,
  counted_by uuid references public.profiles(id),
  counted_at timestamptz,
  unique (runner_job_id, order_item_id)
);

create table if not exists public.runner_job_events (
  id uuid primary key default gen_random_uuid(),
  runner_job_id uuid not null references public.runner_jobs(id) on delete cascade,
  event text not null check (event in ('created', 'assigned', 'released', 'started', 'done', 'cancelled')),
  assigned_to uuid references public.profiles(id),
  actor uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

alter table public.payables
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists print_job_id uuid references public.print_jobs(id) on delete set null;

-- ---------------------------------------------------------------------------
-- D. RLS. Reads only; every write goes through the SECURITY DEFINER functions below.
-- ---------------------------------------------------------------------------
alter table public.order_lifecycle_settings enable row level security;
alter table public.order_item_stage_history enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.print_jobs enable row level security;
alter table public.print_job_lines enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_lines enable row level security;
alter table public.runner_jobs enable row level security;
alter table public.runner_job_lines enable row level security;
alter table public.runner_job_events enable row level security;

create or replace function public.is_runner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role::text = 'runner' from public.profiles where id = auth.uid() and is_active), false);
$$;

drop policy if exists olc_settings_select on public.order_lifecycle_settings;
create policy olc_settings_select on public.order_lifecycle_settings for select using (public.can_orders_read());
drop policy if exists olc_settings_update on public.order_lifecycle_settings;
create policy olc_settings_update on public.order_lifecycle_settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists olc_item_history_select on public.order_item_stage_history;
create policy olc_item_history_select on public.order_item_stage_history for select using (public.can_orders_read());
drop policy if exists olc_po_select on public.purchase_orders;
create policy olc_po_select on public.purchase_orders for select using (public.can_orders_read());
drop policy if exists olc_pol_select on public.purchase_order_lines;
create policy olc_pol_select on public.purchase_order_lines for select using (public.can_orders_read());
drop policy if exists olc_pj_select on public.print_jobs;
create policy olc_pj_select on public.print_jobs for select using (public.can_orders_read());
drop policy if exists olc_pjl_select on public.print_job_lines;
create policy olc_pjl_select on public.print_job_lines for select using (public.can_orders_read());

drop policy if exists olc_rj_select on public.runner_jobs;
create policy olc_rj_select on public.runner_jobs for select
  using (public.can_orders_read() or (public.is_runner() and assigned_to = auth.uid()));
drop policy if exists olc_rjl_select on public.runner_job_lines;
create policy olc_rjl_select on public.runner_job_lines for select
  using (public.can_orders_read() or exists (
    select 1 from public.runner_jobs j where j.id = runner_job_id and public.is_runner() and j.assigned_to = auth.uid()));
drop policy if exists olc_rje_select on public.runner_job_events;
create policy olc_rje_select on public.runner_job_events for select using (public.can_orders_read());

-- Clients and business users can see their own deliveries (portal tracking).
drop policy if exists olc_del_select on public.deliveries;
create policy olc_del_select on public.deliveries for select using (
  public.can_orders_read()
  or exists (select 1 from public.orders o where o.id = order_id and (
    (public.is_client() and o.company_id = public.client_company_id())
    or (public.is_business() and o.company_id = public.business_company_id()))));
drop policy if exists olc_dl_select on public.delivery_lines;
create policy olc_dl_select on public.delivery_lines for select using (
  exists (select 1 from public.deliveries d where d.id = delivery_id));

grant select on public.order_lifecycle_settings, public.order_item_stage_history, public.purchase_orders,
  public.purchase_order_lines, public.print_jobs, public.print_job_lines, public.deliveries,
  public.delivery_lines, public.runner_jobs, public.runner_job_lines, public.runner_job_events to authenticated;
grant update on public.order_lifecycle_settings to authenticated;

-- Private bucket for proof photos and signatures. The app uploads with the service role
-- after checking the caller, and shows files through short-lived signed links.
insert into storage.buckets (id, name, public)
values ('order-proofs', 'order-proofs', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- E. Helpers.
-- ---------------------------------------------------------------------------
create or replace function public.olc_actor(p_allow_runner boolean default false)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role in ('admin', 'operations') then
    return v_role;
  end if;
  if p_allow_runner and v_role = 'runner' then
    return v_role;
  end if;
  raise exception 'Not permitted';
end;
$$;

-- Line stage -> order summary stage.
create or replace function public.olc_order_stage_for_line(p_stage text)
returns text
language sql
immutable
as $$
  select case p_stage
    when 'confirmed' then 'created'
    when 'sourcing' then 'procurement'
    when 'supplier_pickup' then 'procurement'
    when 'to_printer' then 'mockup'
    when 'at_printer' then 'client_approval'
    when 'printing' then 'production'
    when 'printer_pickup' then 'production'
    when 'packing' then 'packaging_qc'
    when 'out_for_delivery' then 'dispatched'
    when 'delivered' then 'delivered'
    when 'cancelled' then 'cancelled'
  end;
$$;

create or replace function public.olc_order_stage_rank(p_status text)
returns integer
language sql
immutable
as $$
  select array_position(array['created', 'procurement', 'mockup', 'client_approval', 'production',
    'packaging_qc', 'dispatched', 'partly_delivered', 'delivered'], p_status);
$$;

create or replace function public.olc_set_line_stage(p_item_id uuid, p_stage text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from text;
  v_order uuid;
begin
  select stage, order_id into v_from, v_order from public.order_items where id = p_item_id for update;
  if v_from is null then
    raise exception 'Order line not found';
  end if;
  if v_from = p_stage then
    return;
  end if;
  update public.order_items set stage = p_stage, stage_updated_at = now() where id = p_item_id;
  insert into public.order_item_stage_history (order_item_id, order_id, from_stage, to_stage, changed_by, note)
  values (p_item_id, v_order, v_from, p_stage, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));
end;
$$;

create or replace function public.olc_open_task(p_order_id uuid, p_dept_slug text, p_title text, p_description text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dept uuid;
  v_manager uuid;
  v_company uuid;
begin
  if exists (select 1 from public.tasks where order_id = p_order_id and title = p_title and status in ('open', 'in_progress')) then
    return;
  end if;
  select id, manager_id into v_dept, v_manager from public.departments where slug = p_dept_slug limit 1;
  select company_id into v_company from public.orders where id = p_order_id;
  insert into public.tasks (title, description, order_id, department_id, assigned_to, created_by, status, company_id)
  values (p_title, p_description, p_order_id, v_dept, v_manager, auth.uid(), 'open', v_company);
end;
$$;

create or replace function public.olc_close_tasks(p_order_id uuid, p_title_like text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tasks set status = 'done', completed_at = now()
  where order_id = p_order_id and title like p_title_like and status in ('open', 'in_progress');
$$;

-- ---------------------------------------------------------------------------
-- F. Order summary from its lines.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_order_status(p_order_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
  v_new text;
  v_any_delivered boolean;
  v_all_done boolean;
  v_all_cancelled boolean;
  v_min integer;
  v_dept uuid;
  v_manager uuid;
  v_slug text;
begin
  select status into v_old from public.orders where id = p_order_id for update;
  if v_old is null then
    return null;
  end if;

  select bool_or(qty_delivered > 0), bool_and(stage in ('delivered', 'cancelled')), bool_and(stage = 'cancelled'),
         min(public.olc_order_stage_rank(public.olc_order_stage_for_line(stage))) filter (where stage <> 'cancelled')
    into v_any_delivered, v_all_done, v_all_cancelled, v_min
  from public.order_items where order_id = p_order_id;

  if v_all_done is null then
    return v_old; -- no lines: leave the order alone
  elsif v_all_cancelled then
    v_new := 'cancelled';
  elsif v_all_done then
    v_new := 'delivered';
  elsif v_any_delivered then
    v_new := 'partly_delivered';
  else
    v_new := (array['created', 'procurement', 'mockup', 'client_approval', 'production',
      'packaging_qc', 'dispatched', 'partly_delivered', 'delivered'])[v_min];
  end if;

  if v_new is distinct from v_old then
    v_slug := case v_new
      when 'created' then 'sales' when 'procurement' then 'procurement' when 'mockup' then 'printing'
      when 'client_approval' then 'sales' when 'production' then 'printing' when 'packaging_qc' then 'quality'
      when 'dispatched' then 'logistics' when 'partly_delivered' then 'logistics' when 'delivered' then 'accounts'
      else null end;
    if v_slug is not null then
      select id, manager_id into v_dept, v_manager from public.departments where slug = v_slug limit 1;
    end if;
    perform set_config('olc.internal', 'on', true);
    update public.orders
    set status = v_new,
        current_department_id = coalesce(v_dept, current_department_id),
        assigned_to = coalesce(v_manager, assigned_to),
        actual_delivery_date = case when v_new = 'delivered' then coalesce(actual_delivery_date, current_date) else actual_delivery_date end,
        updated_at = now()
    where id = p_order_id;
    perform set_config('olc.internal', '', true);
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (p_order_id, v_old, v_new, auth.uid(), 'Updated from product line stages', now());
  end if;
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- G. Workflow actions.
-- ---------------------------------------------------------------------------

-- Creates (or extends) an open to_printer runner job for the given lines.
create or replace function public.olc_ensure_handover_job(p_order_id uuid, p_item_ids uuid[], p_from text, p_assigned_to uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job uuid;
  v_printer text;
  v_item record;
begin
  select pv.name into v_printer
  from public.order_items oi join public.printing_vendors pv on pv.id = oi.printing_vendor_id
  where oi.id = any(p_item_ids) limit 1;

  select id into v_job from public.runner_jobs
  where order_id = p_order_id and kind = 'to_printer' and status in ('open', 'assigned') limit 1;
  if v_job is null then
    insert into public.runner_jobs (order_id, kind, status, assigned_to, from_label, to_label, created_by)
    values (p_order_id, 'to_printer', case when p_assigned_to is null then 'open' else 'assigned' end,
            p_assigned_to, p_from, coalesce(v_printer, 'Printer'), auth.uid())
    returning id into v_job;
    insert into public.runner_job_events (runner_job_id, event, assigned_to, actor, note)
    values (v_job, 'created', p_assigned_to, auth.uid(), 'Take goods to the printer');
  end if;
  for v_item in select id, quantity, qty_delivered from public.order_items where id = any(p_item_ids) loop
    insert into public.runner_job_lines (runner_job_id, order_item_id, expected_qty)
    values (v_job, v_item.id, v_item.quantity - v_item.qty_delivered)
    on conflict (runner_job_id, order_item_id) do nothing;
  end loop;
  return v_job;
end;
$$;

-- Plan a line: stock or supplier, which supplier offer, branding or not, which printer.
create or replace function public.plan_order_line(
  p_item_id uuid,
  p_source text,
  p_needs_branding boolean,
  p_supplier_id uuid default null,
  p_supplier_offer_id uuid default null,
  p_printing_vendor_id uuid default null,
  p_unit_cost numeric default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
  v_offer public.product_supplier_offers%rowtype;
  v_branding boolean;
  v_next text;
begin
  perform public.olc_actor(false);
  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then raise exception 'Order line not found'; end if;
  if v_item.stage not in ('confirmed', 'sourcing') then
    raise exception 'This line is already past sourcing';
  end if;
  if exists (select 1 from public.purchase_order_lines l join public.purchase_orders po on po.id = l.purchase_order_id
             where l.order_item_id = p_item_id and po.status <> 'cancelled') then
    raise exception 'Cancel the open purchase order before re-planning this line';
  end if;
  if p_source not in ('stock', 'supplier') then raise exception 'Choose stock or supplier'; end if;

  if p_supplier_offer_id is not null then
    select * into v_offer from public.product_supplier_offers where id = p_supplier_offer_id;
    if not found then raise exception 'Supplier offer not found'; end if;
    p_supplier_id := v_offer.supplier_id;
    p_unit_cost := coalesce(p_unit_cost, v_offer.cost);
  end if;
  if p_source = 'supplier' and p_supplier_id is null then
    raise exception 'Choose a supplier';
  end if;
  v_branding := coalesce(p_needs_branding, v_item.needs_branding);

  update public.order_items
  set fulfil_source = p_source,
      needs_branding = v_branding,
      supplier_id = case when p_source = 'supplier' then p_supplier_id else null end,
      supplier_offer_id = case when p_source = 'supplier' then p_supplier_offer_id else null end,
      printing_vendor_id = case when v_branding then coalesce(p_printing_vendor_id, printing_vendor_id) else null end,
      unit_cost = coalesce(p_unit_cost, unit_cost)
  where id = p_item_id;

  v_next := case when p_source = 'supplier' then 'sourcing' when v_branding then 'to_printer' else 'packing' end;
  perform public.olc_set_line_stage(p_item_id, v_next, 'Line planned');

  if v_next = 'sourcing' then
    perform public.olc_open_task(v_item.order_id, 'procurement', 'Raise purchase order', 'Choose quantities and send the PO to the supplier.');
  elsif v_next = 'to_printer' then
    perform public.olc_ensure_handover_job(v_item.order_id, array[p_item_id], 'Office stock', null);
  end if;

  if not exists (select 1 from public.order_items where order_id = v_item.order_id and stage = 'confirmed') then
    perform public.olc_close_tasks(v_item.order_id, 'Confirm %');
  end if;
  perform public.recompute_order_status(v_item.order_id);
end;
$$;

create or replace function public.create_purchase_order(
  p_order_id uuid,
  p_supplier_id uuid,
  p_item_ids uuid[],
  p_expected_date date default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po uuid;
  v_number text;
  v_count integer;
begin
  perform public.olc_actor(false);
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception 'Choose at least one line';
  end if;
  select count(*) into v_count from public.order_items
  where id = any(p_item_ids) and order_id = p_order_id and stage = 'sourcing' and supplier_id = p_supplier_id;
  if v_count <> array_length(p_item_ids, 1) then
    raise exception 'Every line must be in sourcing with this supplier';
  end if;
  if exists (
    select 1 from public.purchase_order_lines l join public.purchase_orders po on po.id = l.purchase_order_id
    where l.order_item_id = any(p_item_ids) and po.status <> 'cancelled') then
    raise exception 'A line already has an open purchase order';
  end if;

  v_number := 'PO-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMM') || '-' || lpad(nextval('public.purchase_order_seq')::text, 4, '0');
  insert into public.purchase_orders (po_number, order_id, supplier_id, expected_date, notes, created_by)
  values (v_number, p_order_id, p_supplier_id, p_expected_date, nullif(btrim(coalesce(p_notes, '')), ''), auth.uid())
  returning id into v_po;
  insert into public.purchase_order_lines (purchase_order_id, order_item_id, quantity, unit_cost)
  select v_po, id, quantity, unit_cost from public.order_items where id = any(p_item_ids);

  -- TODO(client): meaning of orders.po_number is unconfirmed (client PO or our PO).
  -- Default: our first PO number fills it only when it is empty; an existing value is never overwritten.
  update public.orders set po_number = coalesce(nullif(po_number, ''), v_number), supplier_id = coalesce(supplier_id, p_supplier_id)
  where id = p_order_id;
  return v_po;
end;
$$;

create or replace function public.set_purchase_order_status(p_po_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_job uuid;
  v_supplier text;
  v_amount numeric;
  v_credit integer;
  v_line record;
begin
  perform public.olc_actor(false);
  select * into v_po from public.purchase_orders where id = p_po_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if p_status not in ('sent', 'ready', 'cancelled') then raise exception 'Invalid PO status'; end if;
  if v_po.status in ('collected', 'cancelled') then raise exception 'This PO is closed'; end if;
  if p_status = v_po.status then return; end if;
  if p_status = 'cancelled' and v_po.status = 'ready'
     and exists (select 1 from public.runner_jobs where purchase_order_id = p_po_id and status = 'in_progress') then
    raise exception 'A runner is already on the way for this PO';
  end if;

  update public.purchase_orders
  set status = p_status,
      sent_at = case when p_status in ('sent', 'ready') then coalesce(sent_at, now()) else sent_at end,
      notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes),
      updated_at = now()
  where id = p_po_id;

  select name, credit_period_days into v_supplier, v_credit from public.suppliers where id = v_po.supplier_id;

  if p_status in ('sent', 'ready') and coalesce(public.olc_setting('payable_on') #>> '{}', 'po_sent') = 'po_sent'
     and not exists (select 1 from public.payables where purchase_order_id = p_po_id) then
    select sum(quantity * coalesce(unit_cost, 0)) into v_amount from public.purchase_order_lines where purchase_order_id = p_po_id;
    if coalesce(v_amount, 0) > 0 then
      insert into public.payables (vendor_type, vendor_name, order_id, amount, due_date, status, notes, created_by, purchase_order_id)
      values ('supplier', coalesce(v_supplier, 'Supplier'), v_po.order_id, v_amount,
              current_date + coalesce(v_credit, 0), 'unpaid', 'PO ' || v_po.po_number, auth.uid(), p_po_id);
    end if;
  end if;

  if p_status = 'ready' then
    insert into public.runner_jobs (order_id, kind, status, from_label, to_label, purchase_order_id, created_by)
    values (v_po.order_id, 'supplier_pickup', 'open', coalesce(v_supplier, 'Supplier'), 'Office / printer', p_po_id, auth.uid())
    returning id into v_job;
    insert into public.runner_job_events (runner_job_id, event, actor, note) values (v_job, 'created', auth.uid(), 'Collect PO ' || v_po.po_number);
    for v_line in select l.order_item_id, l.quantity from public.purchase_order_lines l where l.purchase_order_id = p_po_id loop
      insert into public.runner_job_lines (runner_job_id, order_item_id, expected_qty) values (v_job, v_line.order_item_id, v_line.quantity);
      perform public.olc_set_line_stage(v_line.order_item_id, 'supplier_pickup', 'Goods ready at supplier · PO ' || v_po.po_number);
    end loop;
    perform public.olc_close_tasks(v_po.order_id, 'Raise purchase order');
  end if;

  if p_status = 'cancelled' then
    for v_line in select l.order_item_id from public.purchase_order_lines l where l.purchase_order_id = p_po_id loop
      perform public.olc_set_line_stage(v_line.order_item_id, 'sourcing', 'PO ' || v_po.po_number || ' cancelled');
    end loop;
    update public.runner_jobs set status = 'cancelled', updated_at = now() where purchase_order_id = p_po_id and status <> 'done';
  end if;
  perform public.recompute_order_status(v_po.order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Runner jobs: assign, reassign, release, start, complete with counts.
-- ---------------------------------------------------------------------------
create or replace function public.assign_runner_job(p_job_id uuid, p_user_id uuid, p_scheduled_for date default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.runner_jobs%rowtype;
  v_role text;
  v_order text;
begin
  perform public.olc_actor(false);
  select * into v_job from public.runner_jobs where id = p_job_id for update;
  if not found then raise exception 'Runner job not found'; end if;
  if v_job.status in ('done', 'cancelled') then raise exception 'This job is closed'; end if;
  select role::text into v_role from public.profiles where id = p_user_id and is_active;
  if v_role is null or v_role not in ('runner', 'operations', 'admin') then
    raise exception 'Choose an active runner or operations user';
  end if;
  update public.runner_jobs
  set assigned_to = p_user_id,
      status = case when status = 'in_progress' then 'in_progress' else 'assigned' end,
      scheduled_for = coalesce(p_scheduled_for, scheduled_for),
      updated_at = now()
  where id = p_job_id;
  insert into public.runner_job_events (runner_job_id, event, assigned_to, actor, note)
  values (p_job_id, 'assigned', p_user_id, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));
  select order_number into v_order from public.orders where id = v_job.order_id;
  insert into public.notifications (audience, company_id, user_id, title, body, link)
  values ('internal', null, p_user_id, 'New run · ' || coalesce(v_order, ''),
          coalesce(v_job.from_label, '') || ' → ' || coalesce(v_job.to_label, ''), '/crm/runs');
end;
$$;

create or replace function public.release_runner_job(p_job_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.runner_jobs%rowtype;
  v_role text;
begin
  v_role := public.olc_actor(true);
  select * into v_job from public.runner_jobs where id = p_job_id for update;
  if not found then raise exception 'Runner job not found'; end if;
  if v_role = 'runner' and v_job.assigned_to is distinct from auth.uid() then raise exception 'Not your job'; end if;
  if v_job.status in ('done', 'cancelled') then raise exception 'This job is closed'; end if;
  update public.runner_jobs set assigned_to = null, status = 'open', updated_at = now() where id = p_job_id;
  insert into public.runner_job_events (runner_job_id, event, assigned_to, actor, note)
  values (p_job_id, 'released', v_job.assigned_to, auth.uid(), nullif(btrim(coalesce(p_reason, '')), ''));
  perform public.olc_open_task(v_job.order_id, 'logistics', 'Reassign runner job', 'A runner handed a job back. Assign it to someone else.');
end;
$$;

create or replace function public.start_runner_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.runner_jobs%rowtype;
  v_role text;
begin
  v_role := public.olc_actor(true);
  select * into v_job from public.runner_jobs where id = p_job_id for update;
  if not found then raise exception 'Runner job not found'; end if;
  if v_role = 'runner' and v_job.assigned_to is distinct from auth.uid() then raise exception 'Not your job'; end if;
  if v_job.status not in ('open', 'assigned') then return; end if;
  update public.runner_jobs set status = 'in_progress', assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now() where id = p_job_id;
  insert into public.runner_job_events (runner_job_id, event, assigned_to, actor) values (p_job_id, 'started', coalesce(v_job.assigned_to, auth.uid()), auth.uid());
end;
$$;

-- p_counts: [{"order_item_id": "...", "counted": 100, "damaged": 2, "note": "..."}]
create or replace function public.complete_runner_job(
  p_job_id uuid,
  p_counts jsonb,
  p_note text default null,
  p_photo_path text default null,
  p_override_short boolean default false
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.runner_jobs%rowtype;
  v_role text;
  v_line record;
  v_entry jsonb;
  v_counted integer;
  v_damaged integer;
  v_short integer;
  v_issue boolean := false;
  v_issue_text text := '';
  v_branded uuid[] := '{}';
  v_print uuid;
  v_printer uuid;
  v_order public.orders%rowtype;
begin
  v_role := public.olc_actor(true);
  select * into v_job from public.runner_jobs where id = p_job_id for update;
  if not found then raise exception 'Runner job not found'; end if;
  if v_role = 'runner' and v_job.assigned_to is distinct from auth.uid() then raise exception 'Not your job'; end if;
  if v_job.status in ('done', 'cancelled') then raise exception 'This job is closed'; end if;
  if v_job.kind = 'delivery' then raise exception 'Use the delivery form to finish a delivery'; end if;
  select * into v_order from public.orders where id = v_job.order_id;

  -- 1. Record counts.
  for v_line in select l.*, oi.description, oi.needs_branding from public.runner_job_lines l
                join public.order_items oi on oi.id = l.order_item_id where l.runner_job_id = p_job_id loop
    select e.value into v_entry from jsonb_array_elements(coalesce(p_counts, '[]'::jsonb)) as e(value)
    where e.value->>'order_item_id' = v_line.order_item_id::text limit 1;
    if v_entry is null then
      raise exception 'Count missing for %', coalesce(v_line.description, 'a line');
    end if;
    v_counted := greatest(coalesce((v_entry->>'counted')::integer, 0), 0);
    v_damaged := least(greatest(coalesce((v_entry->>'damaged')::integer, 0), 0), v_counted);
    v_short := greatest(v_line.expected_qty - v_counted, 0);
    update public.runner_job_lines
    set counted_qty = v_counted, damaged_qty = v_damaged, short_qty = v_short,
        note = nullif(btrim(coalesce(v_entry->>'note', '')), ''), counted_by = auth.uid(), counted_at = now()
    where id = v_line.id;
    if v_short > 0 or v_damaged > 0 then
      v_issue := true;
      v_issue_text := v_issue_text || coalesce(v_line.description, 'Line') || ': ' || v_short || ' short, ' || v_damaged || ' damaged. ';
      update public.order_items
      set count_issue = concat_ws(' · ', count_issue,
            initcap(replace(v_job.kind, '_', ' ')) || ': ' || v_short || ' short, ' || v_damaged || ' damaged')
      where id = v_line.order_item_id;
    end if;
  end loop;

  -- TODO(client): short / damaged policy. 'continue' flags it and carries on; 'block' stops until ops override.
  if v_issue and coalesce(public.olc_setting('short_count_policy') #>> '{}', 'continue') = 'block'
     and not (p_override_short and v_role in ('admin', 'operations')) then
    raise exception 'Count does not match. Operations must confirm before this job can close. %', v_issue_text;
  end if;

  -- 2. Move lines on.
  for v_line in select l.order_item_id, oi.needs_branding, oi.printing_vendor_id, coalesce(l.counted_qty, 0) - l.damaged_qty as good
                from public.runner_job_lines l join public.order_items oi on oi.id = l.order_item_id
                where l.runner_job_id = p_job_id and oi.stage <> 'cancelled' loop
    if v_job.kind = 'supplier_pickup' then
      if v_line.needs_branding then
        perform public.olc_set_line_stage(v_line.order_item_id, 'to_printer', 'Collected from supplier');
        v_branded := v_branded || v_line.order_item_id;
      else
        perform public.olc_set_line_stage(v_line.order_item_id, 'packing', 'Collected from supplier');
      end if;
    elsif v_job.kind = 'to_printer' then
      perform public.olc_set_line_stage(v_line.order_item_id, 'at_printer', 'Handed to printer');
      v_printer := coalesce(v_line.printing_vendor_id, v_order.printing_vendor_id);
      select id into v_print from public.print_jobs
      where order_id = v_job.order_id and status = 'pending' and printing_vendor_id is not distinct from v_printer limit 1;
      if v_print is null then
        insert into public.print_jobs (order_id, printing_vendor_id, created_by) values (v_job.order_id, v_printer, auth.uid())
        returning id into v_print;
      end if;
      insert into public.print_job_lines (print_job_id, order_item_id, quantity) values (v_print, v_line.order_item_id, greatest(v_line.good, 0))
      on conflict (print_job_id, order_item_id) do update set quantity = excluded.quantity;
    elsif v_job.kind = 'printer_pickup' then
      perform public.olc_set_line_stage(v_line.order_item_id, 'packing', 'Collected from printer');
    end if;
  end loop;

  if v_job.kind = 'supplier_pickup' and v_job.purchase_order_id is not null then
    update public.purchase_orders set status = 'collected', updated_at = now() where id = v_job.purchase_order_id;
  end if;
  if v_job.kind = 'printer_pickup' and v_job.print_job_id is not null then
    update public.print_jobs set status = 'collected', updated_at = now() where id = v_job.print_job_id;
  end if;
  if v_job.kind = 'to_printer' then
    perform public.olc_open_task(v_job.order_id, 'printing', 'Confirm branding approval and give printer go-ahead',
      'Goods are at the printer. Give the go-ahead once the client has approved the branding.');
  end if;

  update public.runner_jobs
  set status = 'done', completed_at = now(), completed_by = auth.uid(),
      photo_path = coalesce(p_photo_path, photo_path),
      notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes), updated_at = now()
  where id = p_job_id;
  insert into public.runner_job_events (runner_job_id, event, assigned_to, actor, note)
  values (p_job_id, 'done', v_job.assigned_to, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''));

  if array_length(v_branded, 1) is not null then
    perform public.olc_ensure_handover_job(v_job.order_id, v_branded, v_job.from_label, v_job.assigned_to);
  end if;

  if v_issue then
    perform public.olc_open_task(v_job.order_id, 'procurement', 'Resolve short or damaged count', v_issue_text);
    perform public.notify_users('internal', v_order.company_id, 'Count issue · ' || v_order.order_number, v_issue_text,
      '/crm/orders/' || v_job.order_id::text);
  end if;
  perform public.recompute_order_status(v_job.order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Printer go-ahead and pickup.
-- ---------------------------------------------------------------------------
create or replace function public.give_print_go_ahead(p_print_job_id uuid, p_expected_ready date default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pj public.print_jobs%rowtype;
  v_approval text;
  v_line record;
begin
  perform public.olc_actor(false);
  select * into v_pj from public.print_jobs where id = p_print_job_id for update;
  if not found then raise exception 'Print job not found'; end if;
  if v_pj.status <> 'pending' then raise exception 'Go-ahead was already given'; end if;
  select client_approval_status into v_approval from public.orders where id = v_pj.order_id;
  if v_approval is distinct from 'approved' then
    raise exception 'The client has not approved the branding yet';
  end if;
  update public.print_jobs
  set status = 'go_ahead', go_ahead_at = now(), go_ahead_by = auth.uid(),
      expected_ready_date = p_expected_ready, notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes), updated_at = now()
  where id = p_print_job_id;
  for v_line in select order_item_id from public.print_job_lines where print_job_id = p_print_job_id loop
    perform public.olc_set_line_stage(v_line.order_item_id, 'printing', 'Printer go-ahead given');
  end loop;
  perform public.olc_close_tasks(v_pj.order_id, 'Confirm branding approval%');
  perform public.recompute_order_status(v_pj.order_id);
end;
$$;

create or replace function public.mark_print_ready(p_print_job_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pj public.print_jobs%rowtype;
  v_job uuid;
  v_printer text;
  v_line record;
begin
  perform public.olc_actor(false);
  select * into v_pj from public.print_jobs where id = p_print_job_id for update;
  if not found then raise exception 'Print job not found'; end if;
  if v_pj.status <> 'go_ahead' then raise exception 'Give the go-ahead first'; end if;
  select name into v_printer from public.printing_vendors where id = v_pj.printing_vendor_id;
  update public.print_jobs set status = 'ready', notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes), updated_at = now()
  where id = p_print_job_id;
  insert into public.runner_jobs (order_id, kind, status, from_label, to_label, print_job_id, created_by)
  values (v_pj.order_id, 'printer_pickup', 'open', coalesce(v_printer, 'Printer'), 'Office (packing)', p_print_job_id, auth.uid())
  returning id into v_job;
  insert into public.runner_job_events (runner_job_id, event, actor, note) values (v_job, 'created', auth.uid(), 'Collect printed goods');
  for v_line in select order_item_id, quantity from public.print_job_lines where print_job_id = p_print_job_id loop
    insert into public.runner_job_lines (runner_job_id, order_item_id, expected_qty) values (v_job, v_line.order_item_id, v_line.quantity);
    perform public.olc_set_line_stage(v_line.order_item_id, 'printer_pickup', 'Printing done');
  end loop;
  perform public.recompute_order_status(v_pj.order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Deliveries. p_lines: [{"order_item_id": "...", "qty": 50}] (qty defaults to what is left).
-- ---------------------------------------------------------------------------
create or replace function public.create_delivery(
  p_order_id uuid,
  p_lines jsonb,
  p_method text,
  p_courier_partner_id uuid default null,
  p_tracking text default null,
  p_runner_id uuid default null,
  p_address text default null,
  p_contact_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_delivery uuid;
  v_job uuid;
  v_entry jsonb;
  v_item public.order_items%rowtype;
  v_qty integer;
  v_count integer := 0;
  v_partial boolean;
begin
  perform public.olc_actor(false);
  if p_method not in ('runner', 'courier') then raise exception 'Choose runner or courier'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_partial := coalesce((public.olc_setting('allow_partial_delivery') #>> '{}')::boolean, true);

  insert into public.deliveries (order_id, method, courier_partner_id, tracking_number, created_by)
  values (p_order_id, p_method, p_courier_partner_id, nullif(btrim(coalesce(p_tracking, '')), ''), auth.uid())
  returning id into v_delivery;

  for v_entry in select value from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    select * into v_item from public.order_items where id = (v_entry->>'order_item_id')::uuid and order_id = p_order_id for update;
    if not found then raise exception 'Order line not found'; end if;
    if v_item.stage <> 'packing' then raise exception '% is not packed yet', coalesce(v_item.description, 'A line'); end if;
    v_qty := coalesce((v_entry->>'qty')::integer, v_item.quantity - v_item.qty_delivered);
    if v_qty < 1 or v_qty > v_item.quantity - v_item.qty_delivered then
      raise exception 'Quantity for % must be between 1 and %', coalesce(v_item.description, 'a line'), v_item.quantity - v_item.qty_delivered;
    end if;
    -- TODO(client): partial deliveries allowed? When switched off, every line goes out in full.
    if not v_partial and v_qty <> v_item.quantity - v_item.qty_delivered then
      raise exception 'Partial deliveries are switched off';
    end if;
    insert into public.delivery_lines (delivery_id, order_item_id, qty_sent) values (v_delivery, v_item.id, v_qty);
    perform public.olc_set_line_stage(v_item.id, 'out_for_delivery', initcap(p_method) || ' delivery · ' || v_qty || ' pcs');
    v_count := v_count + 1;
  end loop;
  if v_count = 0 then raise exception 'Choose at least one packed line'; end if;
  if not v_partial and exists (select 1 from public.order_items where order_id = p_order_id and stage not in ('out_for_delivery', 'delivered', 'cancelled')) then
    raise exception 'Partial deliveries are switched off: send every line together';
  end if;

  if p_method = 'runner' then
    insert into public.runner_jobs (order_id, kind, status, assigned_to, from_label, to_label, address, contact_phone, delivery_id, created_by)
    values (p_order_id, 'delivery', case when p_runner_id is null then 'open' else 'assigned' end, p_runner_id, 'Office',
            (select name from public.companies where id = v_order.company_id), p_address, p_contact_phone, v_delivery, auth.uid())
    returning id into v_job;
    insert into public.runner_job_events (runner_job_id, event, assigned_to, actor) values (v_job, 'created', p_runner_id, auth.uid());
    insert into public.runner_job_lines (runner_job_id, order_item_id, expected_qty)
    select v_job, order_item_id, qty_sent from public.delivery_lines where delivery_id = v_delivery;
    if p_runner_id is not null then
      insert into public.notifications (audience, company_id, user_id, title, body, link)
      values ('internal', null, p_runner_id, 'New delivery · ' || v_order.order_number, coalesce(p_address, ''), '/crm/runs');
    end if;
  else
    update public.orders
    set courier_partner_id = coalesce(p_courier_partner_id, courier_partner_id),
        tracking_number = coalesce(nullif(btrim(coalesce(p_tracking, '')), ''), tracking_number),
        dispatch_date = coalesce(dispatch_date, current_date), updated_at = now()
    where id = p_order_id;
  end if;

  perform public.olc_close_tasks(p_order_id, 'Send the rest of the order');
  perform public.notify_users('client', v_order.company_id, 'Order ' || v_order.order_number || ' is on its way',
    case when p_method = 'courier' and nullif(btrim(coalesce(p_tracking, '')), '') is not null then 'Tracking: ' || btrim(p_tracking) else '' end,
    '/portal/orders/' || p_order_id::text);
  perform public.recompute_order_status(p_order_id);
  return v_delivery;
end;
$$;

-- p_lines: [{"order_item_id": "...", "delivered": 48, "damaged": 1}] (delivered defaults to qty sent).
create or replace function public.complete_delivery(
  p_delivery_id uuid,
  p_lines jsonb,
  p_receiver_name text default null,
  p_receiver_phone text default null,
  p_signature_path text default null,
  p_seal_photo_path text default null,
  p_pod_path text default null,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_del public.deliveries%rowtype;
  v_order public.orders%rowtype;
  v_role text;
  v_job public.runner_jobs%rowtype;
  v_line record;
  v_entry jsonb;
  v_delivered integer;
  v_damaged integer;
  v_good integer;
  v_short integer;
  v_any_short boolean := false;
  v_issue text := '';
begin
  v_role := public.olc_actor(true);
  select * into v_del from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  if v_del.status <> 'out' then raise exception 'This delivery is already closed'; end if;
  select * into v_job from public.runner_jobs where delivery_id = p_delivery_id and status <> 'cancelled' limit 1;
  if v_role = 'runner' and (v_job.id is null or v_job.assigned_to is distinct from auth.uid()) then
    raise exception 'Not your delivery';
  end if;
  select * into v_order from public.orders where id = v_del.order_id;

  if v_del.method = 'runner' then
    if nullif(btrim(coalesce(p_receiver_name, '')), '') is null then raise exception 'Receiver name is required'; end if;
    -- TODO(client): signature and seal / challan photo requirements.
    if coalesce((public.olc_setting('require_signature') #>> '{}')::boolean, true) and p_signature_path is null then
      raise exception 'Receiver signature is required';
    end if;
    if coalesce((public.olc_setting('require_seal_photo') #>> '{}')::boolean, false) and p_seal_photo_path is null then
      raise exception 'Photo of the seal or stamped challan is required';
    end if;
  end if;

  for v_line in select dl.*, oi.description, oi.quantity, oi.qty_delivered as already
                from public.delivery_lines dl join public.order_items oi on oi.id = dl.order_item_id
                where dl.delivery_id = p_delivery_id loop
    select e.value into v_entry from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as e(value)
    where e.value->>'order_item_id' = v_line.order_item_id::text limit 1;
    v_delivered := least(greatest(coalesce((v_entry->>'delivered')::integer, v_line.qty_sent), 0), v_line.qty_sent);
    v_damaged := least(greatest(coalesce((v_entry->>'damaged')::integer, 0), 0), v_delivered);
    v_good := v_delivered - v_damaged;
    v_short := v_line.qty_sent - v_delivered;
    update public.delivery_lines set qty_delivered = v_good, short_qty = v_short, damaged_qty = v_damaged where id = v_line.id;
    update public.order_items set qty_delivered = least(quantity, qty_delivered + v_good) where id = v_line.order_item_id;
    if v_line.already + v_good >= v_line.quantity then
      perform public.olc_set_line_stage(v_line.order_item_id, 'delivered', 'Delivered');
    else
      v_any_short := true;
      perform public.olc_set_line_stage(v_line.order_item_id, 'packing',
        'Delivered ' || (v_line.already + v_good) || ' of ' || v_line.quantity);
    end if;
    if v_short > 0 or v_damaged > 0 then
      v_issue := v_issue || coalesce(v_line.description, 'Line') || ': ' || v_short || ' not received, ' || v_damaged || ' damaged. ';
      update public.order_items
      set count_issue = concat_ws(' · ', count_issue, 'Delivery: ' || v_short || ' not received, ' || v_damaged || ' damaged')
      where id = v_line.order_item_id;
    end if;
  end loop;

  update public.deliveries
  set status = case when v_any_short then 'partly_delivered' else 'delivered' end,
      receiver_name = nullif(btrim(coalesce(p_receiver_name, '')), ''),
      receiver_phone = nullif(btrim(coalesce(p_receiver_phone, '')), ''),
      signature_path = p_signature_path, seal_photo_path = p_seal_photo_path, pod_path = p_pod_path,
      delivered_at = now(), completed_by = auth.uid(),
      notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), notes), updated_at = now()
  where id = p_delivery_id;

  if v_job.id is not null then
    update public.runner_job_lines rl
    set counted_qty = coalesce(dl.qty_delivered, 0) + dl.damaged_qty, damaged_qty = dl.damaged_qty, short_qty = dl.short_qty,
        counted_by = auth.uid(), counted_at = now()
    from public.delivery_lines dl
    where rl.runner_job_id = v_job.id and dl.delivery_id = p_delivery_id and dl.order_item_id = rl.order_item_id;
    update public.runner_jobs set status = 'done', completed_at = now(), completed_by = auth.uid(), updated_at = now() where id = v_job.id;
    insert into public.runner_job_events (runner_job_id, event, assigned_to, actor) values (v_job.id, 'done', v_job.assigned_to, auth.uid());
  end if;

  if v_any_short then
    perform public.olc_open_task(v_del.order_id, 'logistics', 'Send the rest of the order', nullif(v_issue, ''));
  end if;
  if v_issue <> '' then
    perform public.notify_users('internal', v_order.company_id, 'Delivery issue · ' || v_order.order_number, v_issue,
      '/crm/orders/' || v_del.order_id::text);
  end if;
  perform public.notify_users('client', v_order.company_id,
    case when v_any_short then 'Part of order ' || v_order.order_number || ' delivered' else 'Order ' || v_order.order_number || ' delivered' end,
    '', '/portal/orders/' || v_del.order_id::text);
  perform public.recompute_order_status(v_del.order_id);
end;
$$;

create or replace function public.cancel_order_line(p_item_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.order_items%rowtype;
begin
  perform public.olc_actor(false);
  select * into v_item from public.order_items where id = p_item_id for update;
  if not found then raise exception 'Order line not found'; end if;
  if v_item.stage in ('out_for_delivery', 'delivered', 'cancelled') then raise exception 'This line can no longer be cancelled'; end if;
  perform public.olc_set_line_stage(p_item_id, 'cancelled', coalesce(nullif(btrim(coalesce(p_reason, '')), ''), 'Line cancelled'));
  delete from public.runner_job_lines rl using public.runner_jobs j
  where rl.runner_job_id = j.id and rl.order_item_id = p_item_id and j.status in ('open', 'assigned');
  update public.runner_jobs j set status = 'cancelled', updated_at = now()
  where j.order_id = v_item.order_id and j.status in ('open', 'assigned')
    and not exists (select 1 from public.runner_job_lines rl where rl.runner_job_id = j.id);
  perform public.recompute_order_status(v_item.order_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Branding approval: a gate on the print go-ahead, not a stage. Can be given early.
-- ---------------------------------------------------------------------------
create or replace function public.olc_apply_branding_decision(p_order_id uuid, p_decision text, p_note text, p_by_client boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_note text;
  v_open integer;
  v_at_printer integer;
begin
  if p_decision not in ('approved', 'changes_requested') then raise exception 'Invalid approval decision'; end if;
  v_note := left(nullif(btrim(coalesce(p_note, '')), ''), 2000);
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('delivered', 'cancelled') then raise exception 'This order is closed'; end if;

  -- Same decision just made: no second history row or notification.
  if v_order.client_approval_status = p_decision
     and (p_decision = 'approved' or v_order.client_approval_at >= now() - interval '60 seconds') then
    return;
  end if;

  select count(*) filter (where stage in ('confirmed', 'sourcing', 'supplier_pickup', 'to_printer', 'at_printer')),
         count(*) filter (where stage = 'at_printer')
    into v_open, v_at_printer
  from public.order_items where order_id = p_order_id and needs_branding;
  if v_open = 0 then
    raise exception 'No product on this order is waiting for branding approval';
  end if;
  -- TODO(client): may the client approve before the goods reach the printer? Default yes.
  if v_at_printer = 0 and not coalesce((public.olc_setting('early_branding_approval') #>> '{}')::boolean, true) then
    raise exception 'Branding can be approved once the goods are at the printer';
  end if;

  update public.orders
  set client_approval_status = p_decision, client_approval_note = v_note,
      client_approval_by = auth.uid(), client_approval_at = now(), updated_at = now()
  where id = p_order_id;

  update public.mockups
  set status = case when p_decision = 'approved' then 'approved'::mockup_status else 'rejected'::mockup_status end
  where order_id = p_order_id and status = 'shared';

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
  values (p_order_id, v_order.status, v_order.status, auth.uid(),
    concat_ws(' ', case when p_decision = 'approved' then 'Branding approved' else 'Branding changes requested' end
      || case when p_by_client then ' by client.' else ' (recorded by staff).' end, v_note), now());

  if p_decision = 'changes_requested' then
    perform public.olc_open_task(p_order_id, 'printing', 'Revise mockup', v_note);
  else
    perform public.olc_close_tasks(p_order_id, 'Revise mockup');
  end if;
  perform public.notify_users('internal', v_order.company_id,
    case when p_decision = 'approved' then 'Branding approved · ' else 'Mockup changes requested · ' end || v_order.order_number,
    coalesce(v_note, ''), '/crm/orders/' || p_order_id::text);
end;
$$;

create or replace function public.record_branding_approval(p_order_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role::text into v_role from public.profiles where id = auth.uid() and is_active;
  if v_role is null or v_role not in ('admin', 'sales', 'operations') then raise exception 'Not permitted'; end if;
  perform public.olc_apply_branding_decision(p_order_id, p_decision, p_note, false);
end;
$$;

-- Client branding decision for the new app; works at any point before printing starts.
-- client_decide_order_approval (old app) is left as it is until go-live.
create or replace function public.client_decide_branding_approval(p_order_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
begin
  if not public.is_client() then raise exception 'Only portal clients can use this action'; end if;
  select company_id into v_company from public.orders where id = p_order_id;
  if v_company is null then raise exception 'Order not found'; end if;
  if v_company is distinct from public.client_company_id() then raise exception 'Not permitted to approve this order'; end if;
  perform public.olc_apply_branding_decision(p_order_id, p_decision, p_note, true);
end;
$$;

-- Hand-off for the new app (same arguments as advance_order_stage, which the old app keeps
-- using until go-live). Assignee, department, due date, next action and comment still work;
-- the stage itself follows the product lines. Cancel cascades to lines and jobs.
create or replace function public.olc_hand_off_order(
  p_order_id uuid, p_status text, p_assigned_to uuid default null, p_department_id uuid default null,
  p_comment text default null, p_stage_due text default null, p_next_action text default null,
  p_expected_status text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_due date;
  v_item record;
begin
  perform public.olc_actor(false);
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_expected_status is not null and v_order.status is distinct from p_expected_status then
    raise exception 'Order already moved: it is now in stage %. Refresh to see the latest stage.', v_order.status;
  end if;
  if p_status is not null and p_status is distinct from v_order.status and p_status <> 'cancelled' then
    raise exception 'Stages now move per product line. Use the Fulfilment tab on the order.';
  end if;
  if p_stage_due is not null and btrim(p_stage_due) <> '' then v_due := btrim(p_stage_due)::date; end if;

  if p_status = 'cancelled' and v_order.status <> 'cancelled' then
    if v_order.status = 'delivered' then raise exception 'This stage is terminal'; end if;
    for v_item in select id from public.order_items where order_id = p_order_id and stage not in ('delivered', 'cancelled') loop
      perform public.olc_set_line_stage(v_item.id, 'cancelled', 'Order cancelled');
    end loop;
    update public.runner_jobs set status = 'cancelled', updated_at = now() where order_id = p_order_id and status in ('open', 'assigned', 'in_progress');
    update public.purchase_orders set status = 'cancelled', updated_at = now() where order_id = p_order_id and status in ('draft', 'sent', 'ready');
    update public.print_jobs set status = 'cancelled', updated_at = now() where order_id = p_order_id and status in ('pending', 'go_ahead', 'ready');
    update public.deliveries set status = 'cancelled', updated_at = now() where order_id = p_order_id and status = 'out';
    perform set_config('olc.internal', 'on', true);
    update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
    perform set_config('olc.internal', '', true);
  end if;

  update public.orders
  set assigned_to = coalesce(p_assigned_to, assigned_to),
      current_department_id = coalesce(p_department_id, current_department_id),
      next_action = coalesce(nullif(btrim(p_next_action), ''), next_action),
      stage_due_at = coalesce(v_due, stage_due_at),
      updated_at = now()
  where id = p_order_id;

  if p_assigned_to is not null or p_department_id is not null then
    insert into public.order_assignments (order_id, department_id, assigned_to, assigned_by, note)
    values (p_order_id, coalesce(p_department_id, v_order.current_department_id), p_assigned_to, auth.uid(), nullif(btrim(p_comment), ''));
  end if;
  if (p_status = 'cancelled' and v_order.status <> 'cancelled') or nullif(btrim(p_comment), '') is not null then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (p_order_id, v_order.status, case when p_status = 'cancelled' then 'cancelled' else v_order.status end,
            auth.uid(), nullif(btrim(p_comment), ''), now());
  end if;
end;
$$;

-- Runners only see notifications addressed to them.
drop policy if exists notifications_select_runner on public.notifications;
create policy notifications_select_runner on public.notifications for select
  using (public.is_runner() and user_id = auth.uid());
drop policy if exists notifications_update_runner on public.notifications;
create policy notifications_update_runner on public.notifications for update
  using (public.is_runner() and user_id = auth.uid()) with check (public.is_runner() and user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- H. New lines start in the right place (Phase 0: no forced mockup / approval
--    for stock or unbranded products).
-- ---------------------------------------------------------------------------
create or replace function public.order_items_lifecycle_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_status text;
begin
  select coalesce(source, 'crm'), status into v_source, v_status from public.orders where id = new.order_id;
  if new.fulfil_source is null then
    new.fulfil_source := case when coalesce(public.olc_setting('stock_sources'), '[]'::jsonb) ? v_source then 'stock' else 'supplier' end;
  end if;
  if not (coalesce(public.olc_setting('branding_sources'), '[]'::jsonb) ? v_source) then
    new.needs_branding := false;
  end if;
  if v_status = 'cancelled' then
    new.stage := 'cancelled';
  elsif new.stage = 'confirmed' and new.fulfil_source = 'stock' and not new.needs_branding then
    -- In stock, no branding: straight to packing.
    new.stage := 'packing';
  end if;
  new.stage_updated_at := now();
  return new;
end;
$$;

create or replace function public.order_items_lifecycle_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_item_stage_history (order_item_id, order_id, from_stage, to_stage, changed_by, note)
  values (new.id, new.order_id, null, new.stage, auth.uid(), 'Line added');
  -- The old app sets the order stage itself; only recompute once the new rules are live.
  if coalesce((public.olc_setting('lifecycle_live') #>> '{}')::boolean, false) then
    perform public.recompute_order_status(new.order_id);
  end if;
  return null;
end;
$$;

-- While the old app is live it moves orders.status itself. Keep the lines in step so the new
-- screens show the right stage. Writes only new columns and the new history table, never
-- raises (an error here must not block the old Advance button), and does nothing once
-- 'lifecycle_live' is on or when the change came from the new functions (olc.internal).
create or replace function public.olc_legacy_status_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if coalesce(current_setting('olc.internal', true), '') = 'on' then
    return null;
  end if;
  if coalesce((public.olc_setting('lifecycle_live') #>> '{}')::boolean, false) then
    return null;
  end if;
  v_stage := case new.status
    when 'created' then 'confirmed'
    when 'procurement' then 'sourcing'
    when 'mockup' then 'at_printer'
    when 'client_approval' then 'at_printer'
    when 'production' then 'printing'
    when 'packaging_qc' then 'packing'
    when 'dispatched' then 'out_for_delivery'
    when 'delivered' then 'delivered'
    when 'cancelled' then 'cancelled'
    else null end;
  if v_stage is null then
    return null;
  end if;
  insert into public.order_item_stage_history (order_item_id, order_id, from_stage, to_stage, changed_by, note)
  select oi.id, oi.order_id, oi.stage, v_stage, auth.uid(), 'Order stage changed to ' || new.status
  from public.order_items oi
  where oi.order_id = new.id and oi.stage <> 'cancelled' and oi.stage is distinct from v_stage;
  update public.order_items oi
  set stage = v_stage,
      qty_delivered = case when v_stage = 'delivered' then oi.quantity else oi.qty_delivered end,
      stage_updated_at = now()
  where oi.order_id = new.id and oi.stage <> 'cancelled' and oi.stage is distinct from v_stage;
  return null;
exception when others then
  raise warning 'olc_legacy_status_sync skipped for order %: %', new.id, sqlerrm;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- I. Backfill existing orders. orders.status is NOT changed here.
-- ---------------------------------------------------------------------------
update public.order_items oi
set stage = case o.status
      when 'created' then 'confirmed'
      when 'procurement' then 'sourcing'
      when 'mockup' then 'at_printer'
      when 'client_approval' then 'at_printer'
      when 'production' then 'printing'
      when 'packaging_qc' then 'packing'
      when 'dispatched' then 'out_for_delivery'
      when 'delivered' then 'delivered'
      when 'cancelled' then 'cancelled'
      else 'confirmed' end,
    needs_branding = coalesce(public.olc_setting('branding_sources'), '[]'::jsonb) ? coalesce(o.source, 'crm'),
    fulfil_source = case when coalesce(public.olc_setting('stock_sources'), '[]'::jsonb) ? coalesce(o.source, 'crm') then 'stock' else 'supplier' end,
    supplier_id = o.supplier_id,
    printing_vendor_id = case when coalesce(public.olc_setting('branding_sources'), '[]'::jsonb) ? coalesce(o.source, 'crm') then o.printing_vendor_id end,
    qty_delivered = case when o.status = 'delivered' then oi.quantity else 0 end,
    stage_updated_at = coalesce(o.updated_at, now())
from public.orders o
where o.id = oi.order_id;

insert into public.order_item_stage_history (order_item_id, order_id, from_stage, to_stage, changed_by, note, changed_at)
select oi.id, oi.order_id, null, oi.stage, null, 'Migrated from order stage ' || o.status, now()
from public.order_items oi join public.orders o on o.id = oi.order_id;

-- Print jobs for orders already at the printer.
with pj as (
  insert into public.print_jobs (order_id, printing_vendor_id, status, go_ahead_at, notes)
  select o.id, o.printing_vendor_id,
         case when o.status = 'production' then 'go_ahead' else 'pending' end,
         case when o.status = 'production' then coalesce(o.updated_at, now()) end,
         'Migrated from order stage ' || o.status
  from public.orders o
  where o.status in ('mockup', 'client_approval', 'production')
    and not exists (select 1 from public.print_jobs p where p.order_id = o.id)
  returning id, order_id
)
insert into public.print_job_lines (print_job_id, order_item_id, quantity)
select pj.id, oi.id, oi.quantity from pj join public.order_items oi on oi.order_id = pj.order_id
where oi.stage in ('at_printer', 'printing');

-- Courier deliveries for orders already dispatched.
with d as (
  insert into public.deliveries (order_id, method, courier_partner_id, tracking_number, status, notes)
  select o.id, 'courier', o.courier_partner_id, o.tracking_number, 'out', 'Migrated from order stage dispatched'
  from public.orders o
  where o.status = 'dispatched' and not exists (select 1 from public.deliveries x where x.order_id = o.id)
  returning id, order_id
)
insert into public.delivery_lines (delivery_id, order_item_id, qty_sent)
select d.id, oi.id, oi.quantity from d join public.order_items oi on oi.order_id = d.order_id
where oi.stage = 'out_for_delivery';

-- Triggers go on after the backfill.
drop trigger if exists order_items_lifecycle_defaults on public.order_items;
create trigger order_items_lifecycle_defaults before insert on public.order_items
  for each row execute function public.order_items_lifecycle_defaults();
drop trigger if exists order_items_lifecycle_after_insert on public.order_items;
create trigger order_items_lifecycle_after_insert after insert on public.order_items
  for each row execute function public.order_items_lifecycle_after_insert();
drop trigger if exists orders_olc_legacy_status_sync on public.orders;
create trigger orders_olc_legacy_status_sync after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public.olc_legacy_status_sync();

-- ---------------------------------------------------------------------------
-- J. Grants.
-- ---------------------------------------------------------------------------
revoke execute on function public.olc_set_line_stage(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.olc_open_task(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.olc_close_tasks(uuid, text) from public, anon, authenticated;
revoke execute on function public.olc_ensure_handover_job(uuid, uuid[], text, uuid) from public, anon, authenticated;
revoke execute on function public.recompute_order_status(uuid) from public, anon, authenticated;
revoke execute on function public.olc_apply_branding_decision(uuid, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.order_items_lifecycle_defaults() from public, anon, authenticated;
revoke execute on function public.order_items_lifecycle_after_insert() from public, anon, authenticated;
revoke execute on function public.olc_legacy_status_sync() from public, anon, authenticated;
revoke execute on function public.olc_hand_off_order(uuid, text, uuid, uuid, text, text, text, text) from public, anon;
revoke execute on function public.client_decide_branding_approval(uuid, text, text) from public, anon;

revoke execute on function public.plan_order_line(uuid, text, boolean, uuid, uuid, uuid, numeric) from public, anon;
revoke execute on function public.create_purchase_order(uuid, uuid, uuid[], date, text) from public, anon;
revoke execute on function public.set_purchase_order_status(uuid, text, text) from public, anon;
revoke execute on function public.assign_runner_job(uuid, uuid, date, text) from public, anon;
revoke execute on function public.release_runner_job(uuid, text) from public, anon;
revoke execute on function public.start_runner_job(uuid) from public, anon;
revoke execute on function public.complete_runner_job(uuid, jsonb, text, text, boolean) from public, anon;
revoke execute on function public.give_print_go_ahead(uuid, date, text) from public, anon;
revoke execute on function public.mark_print_ready(uuid, text) from public, anon;
revoke execute on function public.create_delivery(uuid, jsonb, text, uuid, text, uuid, text, text) from public, anon;
revoke execute on function public.complete_delivery(uuid, jsonb, text, text, text, text, text, text) from public, anon;
revoke execute on function public.cancel_order_line(uuid, text) from public, anon;
revoke execute on function public.record_branding_approval(uuid, text, text) from public, anon;

grant execute on function public.plan_order_line(uuid, text, boolean, uuid, uuid, uuid, numeric),
  public.create_purchase_order(uuid, uuid, uuid[], date, text),
  public.set_purchase_order_status(uuid, text, text),
  public.assign_runner_job(uuid, uuid, date, text),
  public.release_runner_job(uuid, text),
  public.start_runner_job(uuid),
  public.complete_runner_job(uuid, jsonb, text, text, boolean),
  public.give_print_go_ahead(uuid, date, text),
  public.mark_print_ready(uuid, text),
  public.create_delivery(uuid, jsonb, text, uuid, text, uuid, text, text),
  public.complete_delivery(uuid, jsonb, text, text, text, text, text, text),
  public.cancel_order_line(uuid, text),
  public.record_branding_approval(uuid, text, text),
  public.olc_hand_off_order(uuid, text, uuid, uuid, text, text, text, text),
  public.client_decide_branding_approval(uuid, text, text),
  public.is_runner(), public.olc_setting(text), public.olc_actor(boolean)
to authenticated, service_role;
