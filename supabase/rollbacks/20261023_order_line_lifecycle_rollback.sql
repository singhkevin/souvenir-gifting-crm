-- Rollback for 20261023_order_line_lifecycle.sql.
-- Restores the order-level stage flow exactly as it was before (advance_order_stage and
-- client_decide_order_approval are the definitions that were live on 2026-10-22).
-- orders, order_items rows, their quantities and prices are kept. orders.status keeps its
-- current value; an order in 'partly_delivered' goes back to 'dispatched' (also in its history)
-- because the old check does not allow that value.
-- LOST on rollback: line stages, purchase orders, print jobs, runner jobs, counts, deliveries
-- and proof file paths (files stay in the order-proofs bucket, which is only removed when empty).
-- Take a backup / export of those tables first if they hold real data.

drop trigger if exists order_items_lifecycle_defaults on public.order_items;
drop trigger if exists order_items_lifecycle_after_insert on public.order_items;

drop policy if exists notifications_select_runner on public.notifications;
drop policy if exists notifications_update_runner on public.notifications;

-- Old order-level functions.
CREATE OR REPLACE FUNCTION public.advance_order_stage(p_order_id uuid, p_status text, p_assigned_to uuid DEFAULT NULL::uuid, p_department_id uuid DEFAULT NULL::uuid, p_comment text DEFAULT NULL::text, p_stage_due text DEFAULT NULL::text, p_next_action text DEFAULT NULL::text, p_expected_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_role text;
  v_next text;
  v_due date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null or v_role not in ('admin', 'operations') then
    raise exception 'Not permitted to change order stages';
  end if;

  if p_status is null or btrim(p_status) = '' then
    raise exception 'Stage is required';
  end if;

  if p_status not in (
    'created', 'procurement', 'mockup', 'client_approval', 'production',
    'packaging_qc', 'dispatched', 'delivered', 'cancelled'
  ) then
    raise exception 'Invalid stage';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  -- Optimistic guard: the caller names the stage it was looking at. If another request
  -- already moved the order, fail instead of applying a second, unintended move.
  if p_expected_status is not null and v_order.status is distinct from p_expected_status then
    raise exception 'Order already moved: it is now in stage %. Refresh to see the latest stage.', v_order.status;
  end if;

  if p_stage_due is not null and btrim(p_stage_due) <> '' then
    v_due := btrim(p_stage_due)::date;
  end if;

  if p_status is distinct from v_order.status then
    if v_order.status in ('delivered', 'cancelled') then
      raise exception 'This stage is terminal';
    end if;

    if p_status = 'cancelled' then
      null;
    elsif v_order.status = 'client_approval' and p_status = 'mockup' then
      null;
    else
      v_next := case v_order.status
        when 'created' then 'procurement'
        when 'procurement' then 'mockup'
        when 'mockup' then 'client_approval'
        when 'client_approval' then 'production'
        when 'production' then 'packaging_qc'
        when 'packaging_qc' then 'dispatched'
        when 'dispatched' then 'delivered'
        else null
      end;

      if p_status is distinct from v_next then
        raise exception 'Move one stage at a time';
      end if;

      if v_order.status = 'client_approval'
         and p_status = 'production'
         and v_order.client_approval_status is distinct from 'approved' then
        raise exception 'Client approval is required before production';
      end if;
    end if;
  end if;

  update public.orders
  set
    status = p_status,
    assigned_to = coalesce(p_assigned_to, assigned_to),
    current_department_id = coalesce(p_department_id, current_department_id),
    next_action = coalesce(nullif(btrim(p_next_action), ''), next_action),
    client_approval_status = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then 'changes_requested'
      else client_approval_status
    end,
    client_approval_note = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then coalesce(nullif(btrim(p_comment), ''), client_approval_note)
      else client_approval_note
    end,
    client_approval_by = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then auth.uid()
      else client_approval_by
    end,
    client_approval_at = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then now()
      else client_approval_at
    end,
    updated_at = now()
  where id = p_order_id;

  if v_due is not null then
    update public.orders
    set stage_due_at = v_due
    where id = p_order_id;
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
    values (
      p_order_id,
      v_order.status,
      p_status,
      auth.uid(),
      nullif(btrim(p_comment), ''),
      now()
    );
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.client_decide_order_approval(p_order_id uuid, p_decision text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
  v_note text;
  v_dept uuid;
  v_manager uuid;
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;

  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Invalid approval decision';
  end if;

  v_note := left(nullif(btrim(coalesce(p_note, '')), ''), 2000);

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.company_id is distinct from public.client_company_id() then
    raise exception 'Not permitted to approve this order';
  end if;

  -- Repeat of a decision that already went through is a no-op, not a second history row
  -- and notification.
  if p_decision = 'approved'
     and v_order.status = 'client_approval'
     and v_order.client_approval_status = 'approved' then
    return;
  end if;

  if p_decision = 'changes_requested'
     and v_order.status = 'mockup'
     and v_order.client_approval_status = 'changes_requested'
     and v_order.client_approval_at >= now() - interval '60 seconds' then
    return;
  end if;

  if v_order.status is distinct from 'client_approval' then
    raise exception 'This order is not waiting for client approval';
  end if;

  if p_decision = 'approved' then
    update public.orders
    set
      client_approval_status = 'approved',
      client_approval_note = v_note,
      client_approval_by = auth.uid(),
      client_approval_at = now(),
      updated_at = now()
    where id = p_order_id;

    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (
      p_order_id,
      'client_approval',
      'client_approval',
      auth.uid(),
      concat_ws(' ', 'Client approved.', v_note),
      now()
    );

    perform public.notify_users(
      'internal',
      v_order.company_id,
      'Client approved the mockup',
      coalesce(v_note, ''),
      '/crm/orders/' || p_order_id::text
    );
    return;
  end if;

  select id, manager_id
    into v_dept, v_manager
  from public.departments
  where slug = 'printing'
  limit 1;

  update public.orders
  set
    status = 'mockup',
    client_approval_status = 'changes_requested',
    client_approval_note = v_note,
    client_approval_by = auth.uid(),
    client_approval_at = now(),
    current_department_id = coalesce(v_dept, current_department_id),
    assigned_to = coalesce(v_manager, assigned_to),
    updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
  values (
    p_order_id,
    'client_approval',
    'mockup',
    auth.uid(),
    concat_ws(' ', 'Changes requested.', v_note),
    now()
  );

  if v_dept is not null or v_manager is not null then
    insert into public.order_assignments (order_id, department_id, assigned_to, assigned_by, note)
    values (p_order_id, v_dept, v_manager, auth.uid(), concat_ws(' ', 'Changes requested.', v_note));
  end if;

  perform public.notify_users(
    'internal',
    v_order.company_id,
    'Client requested mockup changes',
    coalesce(v_note, ''),
    '/crm/orders/' || p_order_id::text
  );
end;
$function$;


drop function if exists public.plan_order_line(uuid, text, boolean, uuid, uuid, uuid, numeric);
drop function if exists public.create_purchase_order(uuid, uuid, uuid[], date, text);
drop function if exists public.set_purchase_order_status(uuid, text, text);
drop function if exists public.assign_runner_job(uuid, uuid, date, text);
drop function if exists public.release_runner_job(uuid, text);
drop function if exists public.start_runner_job(uuid);
drop function if exists public.complete_runner_job(uuid, jsonb, text, text, boolean);
drop function if exists public.give_print_go_ahead(uuid, date, text);
drop function if exists public.mark_print_ready(uuid, text);
drop function if exists public.create_delivery(uuid, jsonb, text, uuid, text, uuid, text, text);
drop function if exists public.complete_delivery(uuid, jsonb, text, text, text, text, text, text);
drop function if exists public.cancel_order_line(uuid, text);
drop function if exists public.record_branding_approval(uuid, text, text);
drop function if exists public.olc_apply_branding_decision(uuid, text, text, boolean);
drop function if exists public.olc_ensure_handover_job(uuid, uuid[], text, uuid);
drop function if exists public.recompute_order_status(uuid);
drop function if exists public.olc_close_tasks(uuid, text);
drop function if exists public.olc_open_task(uuid, text, text, text);
drop function if exists public.olc_set_line_stage(uuid, text, text);
drop function if exists public.olc_order_stage_rank(text);
drop function if exists public.olc_order_stage_for_line(text);
drop function if exists public.olc_actor(boolean);
drop function if exists public.order_items_lifecycle_defaults();
drop function if exists public.order_items_lifecycle_after_insert();

-- 'partly_delivered' is not a valid old stage.
update public.orders set status = 'dispatched' where status = 'partly_delivered';
update public.order_status_history set from_status = 'dispatched' where from_status = 'partly_delivered';
update public.order_status_history set to_status = 'dispatched' where to_status = 'partly_delivered';

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in (
  'created', 'procurement', 'mockup', 'client_approval', 'production', 'packaging_qc',
  'dispatched', 'delivered', 'cancelled'));
alter table public.order_status_history drop constraint if exists order_status_history_from_status_check;
alter table public.order_status_history add constraint order_status_history_from_status_check check (
  from_status is null or from_status in ('created', 'procurement', 'mockup', 'client_approval', 'production',
  'packaging_qc', 'dispatched', 'delivered', 'cancelled'));
alter table public.order_status_history drop constraint if exists order_status_history_to_status_check;
alter table public.order_status_history add constraint order_status_history_to_status_check check (
  to_status is null or to_status in ('created', 'procurement', 'mockup', 'client_approval', 'production',
  'packaging_qc', 'dispatched', 'delivered', 'cancelled'));

alter table public.payables drop column if exists purchase_order_id, drop column if exists print_job_id;

drop table if exists public.runner_job_events;
drop table if exists public.runner_job_lines;
drop table if exists public.runner_jobs;
drop table if exists public.delivery_lines;
drop table if exists public.deliveries;
drop table if exists public.print_job_lines;
drop table if exists public.print_jobs;
drop table if exists public.purchase_order_lines;
drop table if exists public.purchase_orders;
drop table if exists public.order_item_stage_history;
drop table if exists public.order_lifecycle_settings;
drop sequence if exists public.purchase_order_seq;
drop function if exists public.olc_setting(text);
drop function if exists public.is_runner();

alter table public.mockups drop column if exists order_item_id, drop column if exists version;

alter table public.order_items drop constraint if exists order_items_stage_check;
alter table public.order_items drop constraint if exists order_items_fulfil_source_check;
alter table public.order_items drop constraint if exists order_items_qty_delivered_check;
drop index if exists public.order_items_stage_idx;
alter table public.order_items
  drop column if exists stage,
  drop column if exists needs_branding,
  drop column if exists fulfil_source,
  drop column if exists supplier_id,
  drop column if exists supplier_offer_id,
  drop column if exists printing_vendor_id,
  drop column if exists unit_cost,
  drop column if exists qty_delivered,
  drop column if exists count_issue,
  drop column if exists stage_updated_at;

-- Remove the proofs bucket only when it holds no files.
do $$
begin
  if not exists (select 1 from storage.objects where bucket_id = 'order-proofs') then
    delete from storage.buckets where id = 'order-proofs';
  end if;
exception when others then
  raise notice 'order-proofs bucket left in place: %', sqlerrm;
end $$;
