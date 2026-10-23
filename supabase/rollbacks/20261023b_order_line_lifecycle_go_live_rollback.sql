-- Rollback for 20261023b_order_line_lifecycle_go_live.sql: back to "new tables present, old
-- app in charge". Order and line rows are kept. Run this BEFORE redeploying the old app.

update public.order_lifecycle_settings
set settings = settings || jsonb_build_object('lifecycle_live', false), updated_at = now()
where id;

-- Old order-level functions, exactly as live on 2026-10-22.
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
