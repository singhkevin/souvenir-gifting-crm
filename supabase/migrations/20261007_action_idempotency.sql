-- Idempotency for mutating actions.
-- Do not apply from the agent. Apply the whole file as one transaction after review.
--
-- 1. action_idempotency + claim/complete/release RPCs: a client-generated key makes a repeated
--    create (RFQ, quotation, catalog, share link, portal client, checkout ...) return the first
--    result instead of creating a second record. The app falls back to running without a key if
--    these functions are missing, so this migration can be applied before or after the deploy.
-- 2. advance_order_stage takes p_expected_status. When it is set and the order is no longer in
--    that stage the call fails with "Order already moved". Callers that omit it behave as before.
-- 3. client_respond_quotation: a second accept returns the order the first accept created; a
--    second reject is a no-op.
-- 4. client_decide_order_approval: repeating an approval (or a just-recorded change request) is a
--    no-op instead of a second history row and notification.
-- 5. convert_quotation_to_order locks the quotation row, and orders.quotation_id is unique, so a
--    quotation can only ever produce one order.
-- 6. Unique (campaign_id, product_id) on campaign_products and (requirement_id, product_id) on
--    requirement_products, created only when no duplicates exist (otherwise skipped with a WARNING).
--
-- Pre-check for step 5 (must return no rows):
--   select quotation_id, count(*) from public.orders
--   where quotation_id is not null group by quotation_id having count(*) > 1;
-- The migration raises (and rolls back) instead of deleting anything when duplicates exist.

begin;

-- 1. Action idempotency keys -------------------------------------------------------------

create table if not exists public.action_idempotency (
  scope text not null,
  key text not null,
  user_id uuid,
  status text not null default 'pending' check (status in ('pending', 'done')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, key),
  constraint action_idempotency_key_len check (char_length(key) between 8 and 100)
);

create index if not exists action_idempotency_created_idx
  on public.action_idempotency (created_at);

comment on table public.action_idempotency is
  'Per-submission keys so a repeated create returns the first result. Only the claim/complete/release functions touch it.';

alter table public.action_idempotency enable row level security;
revoke all on public.action_idempotency from public;
revoke all on public.action_idempotency from anon;
revoke all on public.action_idempotency from authenticated;

create or replace function public.claim_action_key(
  p_scope text,
  p_key text,
  p_stale_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row public.action_idempotency%rowtype;
  v_inserted integer;
begin
  if p_scope is null or p_key is null or char_length(p_key) < 8 or char_length(p_key) > 100 then
    raise exception 'Invalid idempotency key';
  end if;

  -- Housekeeping, roughly once per fifty claims.
  if random() < 0.02 then
    delete from public.action_idempotency where created_at < now() - interval '14 days';
  end if;

  insert into public.action_idempotency (scope, key, user_id)
  values (p_scope, p_key, auth.uid())
  on conflict (scope, key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return jsonb_build_object('state', 'claimed');
  end if;

  select * into v_row
  from public.action_idempotency
  where scope = p_scope and key = p_key
  for update;

  if not found then
    return jsonb_build_object('state', 'claimed');
  end if;

  if v_row.status = 'done' then
    return jsonb_build_object('state', 'done', 'result', v_row.result);
  end if;

  -- Still running. A claim that never completed (crashed request) can be taken over after a while.
  if v_row.updated_at < now() - make_interval(secs => greatest(p_stale_seconds, 30)) then
    update public.action_idempotency
    set updated_at = now(), user_id = coalesce(auth.uid(), user_id)
    where scope = p_scope and key = p_key;
    return jsonb_build_object('state', 'claimed');
  end if;

  return jsonb_build_object('state', 'pending');
end;
$$;

create or replace function public.complete_action_key(
  p_scope text,
  p_key text,
  p_result jsonb default null
)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.action_idempotency
  set status = 'done', result = p_result, updated_at = now()
  where scope = p_scope and key = p_key;
$$;

create or replace function public.release_action_key(p_scope text, p_key text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  delete from public.action_idempotency
  where scope = p_scope and key = p_key and status = 'pending';
$$;

revoke all on function public.claim_action_key(text, text, integer) from public;
revoke all on function public.complete_action_key(text, text, jsonb) from public;
revoke all on function public.release_action_key(text, text) from public;
grant execute on function public.claim_action_key(text, text, integer) to authenticated;
grant execute on function public.complete_action_key(text, text, jsonb) to authenticated;
grant execute on function public.release_action_key(text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.claim_action_key(text, text, integer) to service_role';
    execute 'grant execute on function public.complete_action_key(text, text, jsonb) to service_role';
    execute 'grant execute on function public.release_action_key(text, text) to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.claim_action_key(text, text, integer) from anon';
    execute 'revoke all on function public.complete_action_key(text, text, jsonb) from anon';
    execute 'revoke all on function public.release_action_key(text, text) from anon';
  end if;
end $$;

-- 2. One order per quotation -------------------------------------------------------------

do $$
declare
  v_dupes text;
begin
  select string_agg(quotation_id::text || ' (' || n || ' orders)', ', ')
    into v_dupes
  from (
    select quotation_id, count(*) as n
    from public.orders
    where quotation_id is not null
    group by quotation_id
    having count(*) > 1
    limit 10
  ) d;

  if v_dupes is not null then
    raise exception
      'Cannot make orders.quotation_id unique: duplicate orders already exist for %. Review and merge or relink them first; nothing was changed.',
      v_dupes;
  end if;
end $$;

create unique index if not exists orders_quotation_id_unique
  on public.orders (quotation_id)
  where quotation_id is not null;

-- 3. advance_order_stage with an expected-stage guard ------------------------------------

drop function if exists public.advance_order_stage(uuid, text, uuid, uuid, text, text, text);

create function public.advance_order_stage(
  p_order_id uuid,
  p_status text,
  p_assigned_to uuid default null,
  p_department_id uuid default null,
  p_comment text default null,
  p_stage_due text default null,
  p_next_action text default null,
  p_expected_status text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

comment on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text, text) is
  'Staff stage change. One step forward, cancel, or client_approval back to mockup. Production requires client_approval_status = approved. When p_expected_status is set and differs from the current stage the call fails with "Order already moved". Null assignee, department, due, and next action keep the current values.';

revoke all on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text, text) from public;
grant execute on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text, text) to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text, text) from anon';
  end if;
end $$;

-- 4. Client approval decision: repeat is a no-op -----------------------------------------

create or replace function public.client_decide_order_approval(
  p_order_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
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
$$;

-- 5. Quotation accept: one order, repeat returns it ----------------------------------------

create or replace function public.client_respond_quotation(
  p_quotation_id uuid,
  p_status text,
  p_comment text default null,
  p_accepted_item_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  q public.quotations%rowtype;
  v_ids uuid[];
  v_order_id uuid;
  v_ops uuid;
  v_campaign_id uuid;
  v_req_campaign uuid;
  v_delivery date;
  v_req_deadline date;
  v_cost numeric := 0;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_line_count integer := 0;
  v_active_count integer := 0;
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;

  if p_status not in ('accepted', 'rejected') then
    raise exception 'Invalid response status';
  end if;

  select * into q
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found then
    raise exception 'Quotation not found';
  end if;

  if q.company_id is distinct from public.client_company_id() then
    raise exception 'Not permitted to respond to this quotation';
  end if;

  -- Repeat of a response that already went through: return what the first call produced.
  if p_status = 'accepted' and q.status = 'accepted' then
    select o.id into v_order_id
    from public.orders o
    where o.quotation_id = q.id
    order by o.created_at
    limit 1;
    if v_order_id is not null then
      return v_order_id;
    end if;
  end if;

  if p_status = 'rejected' and q.status = 'rejected' then
    return null;
  end if;

  if p_status = 'rejected' then
    update public.quotation_items
    set client_response = 'rejected'
    where quotation_id = q.id;

    perform public.respond_quotation(p_quotation_id, 'rejected', p_comment);
    return null;
  end if;

  if p_accepted_item_ids is null then
    select coalesce(array_agg(id), '{}'::uuid[])
      into v_ids
    from public.quotation_items
    where quotation_id = q.id;
  else
    select coalesce(array_agg(distinct x), '{}'::uuid[])
      into v_ids
    from unnest(p_accepted_item_ids) as x
    where x is not null;
  end if;

  if coalesce(cardinality(v_ids), 0) < 1 then
    raise exception 'Select at least one line to accept';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as x
    where not exists (
      select 1
      from public.quotation_items qi
      where qi.id = x
        and qi.quotation_id = q.id
    )
  ) then
    raise exception 'One or more items do not belong to this quotation';
  end if;

  select count(*) into v_line_count
  from public.quotation_items qi
  where qi.quotation_id = q.id
    and qi.id = any(v_ids);

  select count(*) into v_active_count
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id and p.status = 'active'
  where qi.quotation_id = q.id
    and qi.id = any(v_ids);

  if v_line_count <> v_active_count then
    raise exception 'An accepted line is no longer available to order';
  end if;

  if exists (select 1 from public.orders where quotation_id = q.id) then
    raise exception 'An order already exists for this quotation';
  end if;

  update public.quotation_items
  set client_response = case when id = any(v_ids) then 'accepted' else 'rejected' end
  where quotation_id = q.id;

  perform public.respond_quotation(p_quotation_id, 'accepted', p_comment);

  select coalesce(sum(round(qi.quantity * qi.unit_price, 2)), 0)
    into v_subtotal
  from public.quotation_items qi
  where qi.quotation_id = q.id
    and qi.id = any(v_ids);

  v_discount := round(v_subtotal * coalesce(q.discount_percent, 0) / 100.0, 2);
  v_tax := round((v_subtotal - v_discount) * coalesce(q.tax_percent, 0) / 100.0, 2);
  v_total := v_subtotal - v_discount + v_tax;

  select coalesce(sum(coalesce(p.supplier_cost, p.price * 0.62) * qi.quantity), 0)
    into v_cost
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and qi.id = any(v_ids)
    and p.status = 'active';

  v_delivery := current_date + 21;
  v_campaign_id := q.campaign_id;
  if q.requirement_id is not null then
    select r.deadline, r.campaign_id
      into v_req_deadline, v_req_campaign
    from public.requirements r
    where r.id = q.requirement_id;
    if found then
      if v_req_deadline is not null then
        v_delivery := v_req_deadline;
      end if;
      if v_campaign_id is null then
        v_campaign_id := v_req_campaign;
      end if;
    end if;
  end if;

  select id into v_ops from public.departments where slug = 'operations';

  insert into public.orders (
    order_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id
  ) values (
    public.next_order_number(), q.company_id, q.contact_id, q.id, q.requirement_id, q.owner_id,
    v_total, v_delivery, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, v_total - v_cost, v_campaign_id
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price,
         round(qi.quantity * qi.unit_price, 2)
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and qi.id = any(v_ids)
    and p.status = 'active';

  insert into public.order_assignments (order_id, department_id, assigned_by, note)
  values (v_order_id, v_ops, auth.uid(), 'Order received from accepted quotation lines');

  insert into public.tasks (title, order_id, department_id, created_by, due_at, description)
  values (
    'Confirm order and assign operations',
    v_order_id,
    v_ops,
    auth.uid(),
    current_date + 1,
    'New order from accepted quotation lines'
  );

  if q.requirement_id is not null then
    update public.requirements set status = 'won' where id = q.requirement_id;
  end if;

  if v_campaign_id is not null then
    update public.campaigns set status = 'order_ready' where id = v_campaign_id;
    perform public.record_campaign_event(
      v_campaign_id,
      'order_created',
      jsonb_build_object('order_id', v_order_id)
    );
  end if;

  perform public.notify_users(
    'internal',
    q.company_id,
    'New order from accepted quotation',
    'Only the lines the client accepted are on this order.',
    '/crm/orders/' || v_order_id::text
  );
  perform public.notify_users(
    'client',
    q.company_id,
    'Your order is confirmed',
    'We have started fulfilment for the lines you accepted.',
    '/portal/orders'
  );

  return v_order_id;
end;
$$;

create or replace function public.convert_quotation_to_order(p_quotation_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  q public.quotations%rowtype;
  v_order_id uuid;
  v_ops uuid;
  v_cost numeric := 0;
  v_item_count integer := 0;
begin
  if not public.has_any_role(array['admin','sales','operations']::public.app_role[]) then
    raise exception 'Not permitted to convert quotations';
  end if;
  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then raise exception 'Quotation not found'; end if;
  if q.status <> 'accepted' then raise exception 'Only accepted quotations can become orders'; end if;
  if exists (select 1 from public.orders where quotation_id = q.id) then
    select id into v_order_id from public.orders where quotation_id = q.id;
    return v_order_id;
  end if;

  select count(*) into v_item_count
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and p.status = 'active'
    and coalesce(p.catalogue_access, 'all') <> 'none';
  if v_item_count = 0 then
    raise exception 'Quotation has no active catalogue products to convert';
  end if;

  select id into v_ops from public.departments where slug = 'operations';
  select coalesce(sum(coalesce(p.supplier_cost, p.price * 0.62) * qi.quantity), 0) into v_cost
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and p.status = 'active'
    and coalesce(p.catalogue_access, 'all') <> 'none';

  insert into public.orders (
    order_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id
  ) values (
    public.next_order_number(), q.company_id, q.contact_id, q.id, q.requirement_id, q.owner_id,
    q.total, current_date + 21, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, q.total - v_cost, q.campaign_id
  ) returning id into v_order_id;

  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price, round(qi.quantity * qi.unit_price, 2)
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and p.status = 'active'
    and coalesce(p.catalogue_access, 'all') <> 'none';

  insert into public.order_assignments (order_id, department_id, assigned_by, note)
  values (v_order_id, v_ops, auth.uid(), 'Order received from accepted quotation');
  insert into public.tasks (title, order_id, department_id, created_by, due_at, description)
  values ('Confirm order and assign operations', v_order_id, v_ops, auth.uid(), current_date + 1, 'New order from quotation');

  if q.requirement_id is not null then
    update public.requirements set status = 'won' where id = q.requirement_id;
  end if;
  if q.campaign_id is not null then
    update public.campaigns set status = 'order_ready' where id = q.campaign_id;
    perform public.record_campaign_event(q.campaign_id, 'order_created', jsonb_build_object('order_id', v_order_id));
  end if;
  perform public.notify_users('internal', q.company_id, 'New order from accepted quotation', '', '/orders/' || v_order_id::text);
  perform public.notify_users('client', q.company_id, 'Your order is confirmed', 'We have started fulfilment.', '/portal/orders');
  return v_order_id;
end;
$function$;

-- 6. Natural unique keys where a repeat insert would otherwise add a second row ----------
-- Created only when the table exists, no unique index already covers the pair, and the existing
-- rows have no duplicates. If duplicates exist the index is skipped with a WARNING and nothing is
-- deleted; resolve the listed pairs by hand and re-run this block.

do $$
declare
  r record;
  v_dupes integer;
begin
  for r in
    select * from (values
      ('campaign_products', 'campaign_id', 'product_id', 'campaign_products_campaign_product_unique'),
      ('requirement_products', 'requirement_id', 'product_id', 'requirement_products_requirement_product_unique')
    ) as t(tbl, col_a, col_b, idx)
  loop
    if to_regclass('public.' || r.tbl) is null then
      raise notice 'Skipping %: table does not exist', r.tbl;
      continue;
    end if;

    if exists (
      select 1
      from pg_index i
      where i.indrelid = ('public.' || r.tbl)::regclass
        and i.indisunique
        and i.indnatts = 2
        and (
          select array_agg(a.attname::text order by a.attname::text)
          from pg_attribute a
          where a.attrelid = i.indrelid and a.attnum = any (i.indkey)
        ) = array[least(r.col_a, r.col_b), greatest(r.col_a, r.col_b)]::text[]
    ) then
      raise notice 'Skipping %: a unique index on (%, %) already exists', r.tbl, r.col_a, r.col_b;
      continue;
    end if;

    execute format(
      'select count(*) from (select 1 from public.%I group by %I, %I having count(*) > 1) d',
      r.tbl, r.col_a, r.col_b
    ) into v_dupes;

    if v_dupes > 0 then
      raise warning
        'Skipping unique index on %(%, %): % duplicate pair(s) exist. Review them with: select %, %, count(*) from public.% group by 1, 2 having count(*) > 1;',
        r.tbl, r.col_a, r.col_b, v_dupes, r.col_a, r.col_b, r.tbl;
      continue;
    end if;

    execute format('create unique index if not exists %I on public.%I (%I, %I)', r.idx, r.tbl, r.col_a, r.col_b);
  end loop;
end $$;

notify pgrst, 'reload schema';

commit;
