-- Portal clients accept or reject a quotation per line.
-- Accepted lines become an order (status created). Rejected lines stay on the quotation.
-- The previous 3-argument client_respond_quotation is dropped so PostgREST is not ambiguous.
-- Staff respond_quotation and convert_quotation_to_order are unchanged.
--
-- Do not apply from the agent. Apply after 20261005_catalog_rfq.sql.

begin;

alter table public.quotation_items
  add column if not exists client_response text;

alter table public.quotation_items
  drop constraint if exists quotation_items_client_response_check;

alter table public.quotation_items
  add constraint quotation_items_client_response_check
  check (client_response is null or client_response in ('accepted', 'rejected'));

comment on column public.quotation_items.client_response is
  'Portal decision for this line: accepted, rejected, or null before the client responds.';

drop function if exists public.client_respond_quotation(uuid, text, text);

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

comment on function public.client_respond_quotation(uuid, text, text, uuid[]) is
  'Portal accept/reject. Reject marks every line rejected and does not create an order. Accept marks the given lines (or every line when ids are null), then creates an order for those lines only at the quoted price and quantity. Header discount and tax percents apply to the accepted subtotal. Order status is created.';

revoke all on function public.client_respond_quotation(uuid, text, text, uuid[]) from public;
grant execute on function public.client_respond_quotation(uuid, text, text, uuid[]) to authenticated;

commit;
