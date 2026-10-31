-- Create an order from a requirement without a quotation.
-- Not applied. Do not run this against production from the agent.
-- No begin/commit: Supabase applies this file in one transaction, same as
-- 20261023c_role_active_checks.sql.
--
-- orders.without_quotation marks staff orders that skipped create / send / accept.
-- The row still uses orders, order_items, order_status_history, assignments and
-- tasks, so plan_order_line and the rest of fulfilment are unchanged.
-- source stays 'crm'. quotation_id stays null, which the check enforces.
--
-- Rollback: supabase/rollbacks/20261031_order_without_quotation_rollback.sql

alter table public.orders
  add column if not exists without_quotation boolean not null default false;

alter table public.orders
  drop constraint if exists orders_without_quotation_check;

alter table public.orders
  add constraint orders_without_quotation_check
  check (without_quotation = false or quotation_id is null);

comment on column public.orders.without_quotation is
  'True when staff created this order from a requirement and skipped the quotation. quotation_id is null.';

create or replace function public.create_order_from_requirement(
  p_requirement_id uuid,
  p_prices jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.requirements%rowtype;
  v_order_id uuid;
  v_ops uuid;
  v_cost numeric := 0;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_line record;
  v_price numeric;
  v_qty numeric;
  v_unit_cost numeric;
begin
  if not public.has_any_role(array['admin', 'sales', 'management']::public.app_role[]) then
    raise exception 'Not permitted to create an order';
  end if;
  if p_requirement_id is null then
    raise exception 'Requirement is required';
  end if;
  if jsonb_typeof(p_prices) is distinct from 'array' then
    raise exception 'Enter a sell price for every product';
  end if;

  select * into r from public.requirements where id = p_requirement_id for update;
  if not found then
    raise exception 'Requirement not found';
  end if;
  if r.company_id is null then
    raise exception 'Requirement has no company';
  end if;

  if exists (select 1 from public.orders where requirement_id = r.id) then
    raise exception 'This requirement already has an order';
  end if;

  if not exists (select 1 from public.requirement_products where requirement_id = r.id) then
    raise exception 'Add at least one product before creating an order';
  end if;

  if exists (
    select 1
    from public.requirement_products rp
    left join public.products p on p.id = rp.product_id
    where rp.requirement_id = r.id
      and p.id is null
  ) then
    raise exception 'A product on this requirement is no longer available';
  end if;

  for v_line in
    select rp.product_id,
           coalesce(rp.quantity, r.quantity, 1) as quantity,
           p.name,
           p.status
    from public.requirement_products rp
    join public.products p on p.id = rp.product_id
    where rp.requirement_id = r.id
  loop
    if v_line.status is distinct from 'active' then
      raise exception '% is no longer active', coalesce(v_line.name, 'A product');
    end if;
    v_qty := v_line.quantity;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Each product needs a quantity';
    end if;

    select max((elem->>'unit_price')::numeric)
      into v_price
    from jsonb_array_elements(p_prices) elem
    where elem->>'product_id' = v_line.product_id::text
      and btrim(elem->>'unit_price') ~ '^[0-9]+(\.[0-9]{1,2})?$';

    if v_price is null or v_price <= 0 then
      raise exception 'Enter a sell price for %', coalesce(v_line.name, 'every product');
    end if;

    v_subtotal := v_subtotal + round(v_qty * v_price, 2);
    select pc.supplier_cost
      into v_unit_cost
    from public.product_costs pc
    where pc.product_id = v_line.product_id
    limit 1;
    v_cost := v_cost + coalesce(v_unit_cost, 0) * v_qty;
  end loop;

  v_subtotal := round(v_subtotal, 2);
  -- 18% matches DIRECT_ORDER_GST_PERCENT in src/lib/orders/direct-order.ts. GST is added once.
  v_tax := round(v_subtotal * 18 / 100, 2);
  v_total := round(v_subtotal + v_tax, 2);
  v_cost := round(v_cost, 2);

  select id into v_ops from public.departments where slug = 'operations';

  insert into public.orders (
    order_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id, source, without_quotation
  ) values (
    public.next_order_number(), r.company_id, r.contact_id, null, r.id, coalesce(r.owner_id, auth.uid()),
    v_total, current_date + 21, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, v_total - v_cost, r.campaign_id, 'crm', true
  ) returning id into v_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order_id, null, 'created', auth.uid(), 'Created without a quotation');

  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id,
         rp.product_id,
         p.name,
         coalesce(rp.quantity, r.quantity, 1),
         priced.unit_price,
         round(coalesce(rp.quantity, r.quantity, 1) * priced.unit_price, 2)
  from public.requirement_products rp
  join public.products p on p.id = rp.product_id
  join lateral (
    select max((elem->>'unit_price')::numeric) as unit_price
    from jsonb_array_elements(p_prices) elem
    where elem->>'product_id' = rp.product_id::text
      and btrim(elem->>'unit_price') ~ '^[0-9]+(\.[0-9]{1,2})?$'
  ) priced on true
  where rp.requirement_id = r.id
    and p.status = 'active';

  if v_ops is not null then
    insert into public.order_assignments (order_id, department_id, assigned_by, note)
    values (v_order_id, v_ops, auth.uid(), 'Order created from a requirement without a quotation');
    insert into public.tasks (title, order_id, department_id, created_by, due_at, description)
    values (
      'Confirm order and assign operations',
      v_order_id,
      v_ops,
      auth.uid(),
      current_date + 1,
      'New order from a requirement, without a quotation'
    );
  end if;

  update public.requirements set status = 'won' where id = r.id;

  if r.campaign_id is not null then
    update public.campaigns set status = 'order_ready' where id = r.campaign_id;
    perform public.record_campaign_event(
      r.campaign_id,
      'order_created',
      jsonb_build_object('order_id', v_order_id, 'without_quotation', true)
    );
  end if;

  perform public.notify_users(
    'internal',
    r.company_id,
    'New order without a quotation',
    'Created from a requirement. Fulfilment is the same as any other order.',
    '/crm/orders/' || v_order_id::text
  );

  return v_order_id;
end;
$$;

revoke execute on function public.create_order_from_requirement(uuid, jsonb) from public, anon;
grant execute on function public.create_order_from_requirement(uuid, jsonb) to authenticated;

comment on function public.create_order_from_requirement(uuid, jsonb) is
  'Staff (admin, sales, management) create an order from requirement products and confirmed ex-GST sell prices. No quotation. Lands in the normal fulfilment flow.';
