-- Rollback for 20261006_fulfillment_stages_client_approval.sql
--
-- Lossy on purpose. confirmed was folded into created, and in_progress into
-- procurement; those original tokens cannot be reconstructed. production,
-- mockup, and client_approval roll back to printing. packaging_qc rolls back
-- to quality_check. History notes written by the forward migration are kept.
--
-- The previous advance_order_stage body was not in the repo. This fallback
-- accepts the previous status set and writes order_status_history. A history
-- trigger dropped by the forward migration is not recreated.
-- Apply together with reverting the app, as one transaction.

begin;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('advance_order_stage', 'client_decide_order_approval', 'order_fulfillment_status_remap')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.order_status_history drop constraint if exists order_status_history_from_status_check;
alter table public.order_status_history drop constraint if exists order_status_history_to_status_check;

create or replace function public.order_fulfillment_status_rollback(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'mockup' then 'printing'
    when 'client_approval' then 'printing'
    when 'production' then 'printing'
    when 'packaging_qc' then 'quality_check'
    else p_status
  end
$$;

alter table public.orders disable trigger user;
alter table public.order_status_history disable trigger user;

update public.order_status_history
set
  from_status = public.order_fulfillment_status_rollback(from_status),
  to_status = public.order_fulfillment_status_rollback(to_status)
where from_status in ('mockup', 'client_approval', 'production', 'packaging_qc')
   or to_status in ('mockup', 'client_approval', 'production', 'packaging_qc');

update public.orders
set status = public.order_fulfillment_status_rollback(status)
where status in ('mockup', 'client_approval', 'production', 'packaging_qc');

alter table public.orders enable trigger user;
alter table public.order_status_history enable trigger user;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'created', 'confirmed', 'in_progress', 'procurement', 'printing',
      'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered', 'cancelled'
    )
  );

alter table public.order_status_history
  add constraint order_status_history_from_status_check
  check (
    from_status is null
    or from_status in (
      'created', 'confirmed', 'in_progress', 'procurement', 'printing',
      'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered', 'cancelled'
    )
  );

alter table public.order_status_history
  add constraint order_status_history_to_status_check
  check (
    to_status is null
    or to_status in (
      'created', 'confirmed', 'in_progress', 'procurement', 'printing',
      'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered', 'cancelled'
    )
  );

drop trigger if exists orders_guard_client_approval on public.orders;
drop function if exists public.guard_order_client_approval();

alter table public.orders drop constraint if exists orders_client_approval_status_check;
alter table public.orders drop constraint if exists orders_client_approval_by_fkey;
alter table public.orders
  drop column if exists client_approval_status,
  drop column if exists client_approval_note,
  drop column if exists client_approval_by,
  drop column if exists client_approval_at;

create function public.advance_order_stage(
  p_order_id uuid,
  p_status text,
  p_assigned_to uuid default null,
  p_department_id uuid default null,
  p_comment text default null,
  p_stage_due text default null,
  p_next_action text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_role text;
  v_due date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null or v_role not in ('admin', 'operations') then
    raise exception 'Not permitted to change order stages';
  end if;

  if p_status not in (
    'created', 'confirmed', 'in_progress', 'procurement', 'printing',
    'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered', 'cancelled'
  ) then
    raise exception 'Invalid stage';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_stage_due is not null and btrim(p_stage_due) <> '' then
    v_due := btrim(p_stage_due)::date;
  end if;

  update public.orders
  set
    status = p_status,
    assigned_to = coalesce(p_assigned_to, assigned_to),
    current_department_id = coalesce(p_department_id, current_department_id),
    next_action = coalesce(nullif(btrim(p_next_action), ''), next_action),
    updated_at = now()
  where id = p_order_id;

  if v_due is not null then
    update public.orders set stage_due_at = v_due where id = p_order_id;
  end if;

  if p_assigned_to is not null or p_department_id is not null then
    insert into public.order_assignments (order_id, department_id, assigned_to, assigned_by, note)
    values (
      p_order_id,
      coalesce(p_department_id, v_order.current_department_id),
      p_assigned_to,
      auth.uid(),
      nullif(btrim(p_comment), '')
    );
  end if;

  if p_status is distinct from v_order.status or nullif(btrim(p_comment), '') is not null then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (p_order_id, v_order.status, p_status, auth.uid(), nullif(btrim(p_comment), ''), now());
  end if;
end;
$$;

revoke all on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) from public;
grant execute on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) to authenticated;

drop function if exists public.order_fulfillment_status_rollback(text);

notify pgrst, 'reload schema';

commit;
