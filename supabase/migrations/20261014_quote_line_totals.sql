-- Quotation line_total is pre-tax after the quotation discount:
--   round(quantity * unit_price * (1 - discount_percent / 100), 2)
-- Tax is stored once on the quotation (and on the order value), not inside the line.
-- Apply after 20261014_categories_unique.sql. Do not apply from the agent.

begin;

create or replace function public.recalc_quotation_totals(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotations%rowtype;
  v_gross numeric := 0;
  v_net numeric := 0;
  v_tax numeric := 0;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.has_any_role(array['admin','sales','management','accounts','operations']::public.app_role[]) then
    raise exception 'Not permitted to recalculate quotation totals';
  end if;

  select * into q from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found';
  end if;

  update public.quotation_items qi
  set line_total = round(
    coalesce(qi.quantity, 0) * coalesce(qi.unit_price, 0) * (1 - coalesce(q.discount_percent, 0) / 100.0),
    2
  )
  where qi.quotation_id = q.id;

  select
    coalesce(sum(round(coalesce(qi.quantity, 0) * coalesce(qi.unit_price, 0), 2)), 0),
    coalesce(sum(qi.line_total), 0)
    into v_gross, v_net
  from public.quotation_items qi
  where qi.quotation_id = q.id;

  v_tax := round(v_net * coalesce(q.tax_percent, 0) / 100.0, 2);

  update public.quotations
  set subtotal = v_gross,
      discount_amount = v_gross - v_net,
      tax_amount = v_tax,
      total = v_net + v_tax,
      updated_at = now()
  where id = q.id;
end;
$$;

comment on function public.recalc_quotation_totals(uuid) is
  'Sets each line_total to the pre-tax discounted amount and stores GST once on the quotation.';

revoke all on function public.recalc_quotation_totals(uuid) from public, anon;
grant execute on function public.recalc_quotation_totals(uuid) to authenticated, service_role;

comment on column public.quotation_items.line_total is
  'Pre-tax line amount after the quotation discount. GST is not included.';

-- Accepted lines are locked. Disable that guard only for this backfill.
alter table public.quotation_items disable trigger quotation_items_lock_accepted;

update public.quotation_items qi
set line_total = round(
  coalesce(qi.quantity, 0) * coalesce(qi.unit_price, 0) * (1 - coalesce(q.discount_percent, 0) / 100.0),
  2
)
from public.quotations q
where q.id = qi.quotation_id;

update public.quotations q
set subtotal = coalesce(s.gross, 0),
    discount_amount = coalesce(s.gross, 0) - coalesce(s.net, 0),
    tax_amount = round(coalesce(s.net, 0) * coalesce(q.tax_percent, 0) / 100.0, 2),
    total = coalesce(s.net, 0) + round(coalesce(s.net, 0) * coalesce(q.tax_percent, 0) / 100.0, 2),
    updated_at = now()
from (
  select quotation_id,
         coalesce(sum(round(coalesce(quantity, 0) * coalesce(unit_price, 0), 2)), 0) as gross,
         coalesce(sum(line_total), 0) as net
  from public.quotation_items
  group by quotation_id
) s
where q.id = s.quotation_id;

update public.quotations q
set subtotal = 0,
    discount_amount = 0,
    tax_amount = 0,
    total = 0,
    updated_at = now()
where not exists (
  select 1 from public.quotation_items qi where qi.quotation_id = q.id
);

alter table public.quotation_items enable trigger quotation_items_lock_accepted;

-- Previous owner ids, so the rollback can put them back.
create table if not exists public.quote_flow_owner_reassignments (
  entity text not null,
  entity_id uuid not null,
  previous_owner_id uuid,
  primary key (entity, entity_id)
);

alter table public.quote_flow_owner_reassignments enable row level security;
revoke all on table public.quote_flow_owner_reassignments from public, anon, authenticated;

create or replace function public.reassign_inactive_owners()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_companies integer := 0;
  v_quotes integer := 0;
  v_reqs integer := 0;
begin
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.has_any_role(array['admin']::public.app_role[]) then
    raise exception 'Not permitted';
  end if;

  select s.business_default_owner_id
    into v_owner
  from public.org_settings s
  join public.profiles p on p.id = s.business_default_owner_id and p.is_active
  limit 1;

  if v_owner is null then
    raise notice 'reassigned inactive owners skipped: business_default_owner_id is missing or inactive';
    return;
  end if;

  insert into public.quote_flow_owner_reassignments (entity, entity_id, previous_owner_id)
  select 'companies', c.id, c.owner_id
  from public.companies c
  join public.profiles p on p.id = c.owner_id and p.is_active = false
  where c.owner_id is distinct from v_owner
  on conflict (entity, entity_id) do nothing;

  insert into public.quote_flow_owner_reassignments (entity, entity_id, previous_owner_id)
  select 'quotations', q.id, q.owner_id
  from public.quotations q
  join public.profiles p on p.id = q.owner_id and p.is_active = false
  where q.owner_id is distinct from v_owner
  on conflict (entity, entity_id) do nothing;

  insert into public.quote_flow_owner_reassignments (entity, entity_id, previous_owner_id)
  select 'requirements', r.id, r.owner_id
  from public.requirements r
  join public.profiles p on p.id = r.owner_id and p.is_active = false
  where r.owner_id is distinct from v_owner
  on conflict (entity, entity_id) do nothing;

  update public.companies c
  set owner_id = v_owner
  from public.profiles p
  where p.id = c.owner_id
    and p.is_active = false
    and c.owner_id is distinct from v_owner;
  get diagnostics v_companies = row_count;

  update public.quotations q
  set owner_id = v_owner
  from public.profiles p
  where p.id = q.owner_id
    and p.is_active = false
    and q.owner_id is distinct from v_owner;
  get diagnostics v_quotes = row_count;

  update public.requirements r
  set owner_id = v_owner
  from public.profiles p
  where p.id = r.owner_id
    and p.is_active = false
    and r.owner_id is distinct from v_owner;
  get diagnostics v_reqs = row_count;

  raise notice 'reassigned inactive owners: companies %, quotations %, requirements %',
    v_companies, v_quotes, v_reqs;
end;
$$;

revoke all on function public.reassign_inactive_owners() from public, anon, authenticated;
grant execute on function public.reassign_inactive_owners() to service_role;

select public.reassign_inactive_owners();

-- Order builders read line_total as pre-tax. Discount is not applied a second time.
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

  select coalesce(sum(qi.line_total), 0)
    into v_subtotal
  from public.quotation_items qi
  where qi.quotation_id = q.id
    and qi.id = any(v_ids);

  -- line_total is pre-tax and already includes the quotation discount. Tax is added once.
  v_discount := 0;
  v_tax := round(v_subtotal * coalesce(q.tax_percent, 0) / 100.0, 2);
  v_total := v_subtotal + v_tax;

  select coalesce(sum(coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62) * qi.quantity), 0)
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
    product_cost, total_cost, gross_profit, campaign_id, source
  ) values (
    public.next_order_number(), q.company_id, q.contact_id, q.id, q.requirement_id, q.owner_id,
    v_total, v_delivery, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, v_total - v_cost, v_campaign_id, 'portal'
  ) returning id into v_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order_id, null, 'created', auth.uid(), 'portal');


  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price,
         qi.line_total
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
  select coalesce(sum(coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62) * qi.quantity), 0) into v_cost
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and p.status = 'active'
    and coalesce(p.catalogue_access, 'all') <> 'none';

  insert into public.orders (
    order_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id, source
  ) values (
    public.next_order_number(), q.company_id, q.contact_id, q.id, q.requirement_id, q.owner_id,
    q.total, current_date + 21, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, q.total - v_cost, q.campaign_id, 'crm'
  ) returning id into v_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order_id, null, 'created', auth.uid(), 'crm');


  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price, qi.line_total
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

create or replace function public.place_quote_order(
  p_token_hash text,
  p_contact jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  t public.quote_checkout_tokens%rowtype;
  q public.quotations%rowtype;
  v_company public.companies%rowtype;
  v_order_id uuid;
  v_ops uuid;
  v_contact uuid;
  v_owner uuid;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_delivery date;
  v_email text;
  v_name text;
begin
  if not v_service then
    raise exception 'Not permitted';
  end if;
  if p_token_hash is null or length(btrim(p_token_hash)) < 32 then
    raise exception 'This checkout link is not valid';
  end if;

  select * into t
  from public.quote_checkout_tokens
  where token_hash = btrim(p_token_hash)
  for update;

  if not found then
    raise exception 'This checkout link is not valid';
  end if;

  if t.used_at is not null then
    if t.order_id is not null then
      return t.order_id;
    end if;
    raise exception 'This checkout link has already been used';
  end if;

  if t.expires_at <= now() then
    raise exception 'This checkout link has expired';
  end if;

  select * into q
  from public.quotations
  where id = t.quotation_id
  for update;

  if not found or q.status <> 'accepted' or q.company_id is distinct from t.company_id then
    raise exception 'This quotation is not ready for checkout';
  end if;

  select * into v_company from public.companies where id = t.company_id;
  if not found
     or v_company.account_type is distinct from 'business'
     or v_company.business_verification is distinct from 'verified' then
    raise exception 'This account is not verified for checkout';
  end if;

  select id into v_order_id
  from public.orders
  where quotation_id = q.id
  order by created_at
  limit 1;

  if v_order_id is not null then
    update public.quote_checkout_tokens
    set used_at = now(),
        order_id = v_order_id
    where id = t.id;
    return v_order_id;
  end if;

  if not exists (
    select 1
    from public.quotation_items qi
    join public.products p on p.id = qi.product_id and p.status = 'active'
    where qi.quotation_id = q.id
      and qi.client_response = 'accepted'
  ) then
    raise exception 'No accepted lines are still available';
  end if;

  if exists (
    select 1
    from public.quotation_items qi
    left join public.products p on p.id = qi.product_id and p.status = 'active'
    where qi.quotation_id = q.id
      and qi.client_response = 'accepted'
      and p.id is null
  ) then
    raise exception 'An accepted line is no longer available';
  end if;

  v_email := nullif(lower(btrim(coalesce(p_contact->>'email', ''))), '');
  v_name := nullif(btrim(coalesce(p_contact->>'full_name', '')), '');
  v_contact := q.contact_id;
  if v_email is not null then
    select id into v_contact
    from public.contacts
    where company_id = q.company_id
      and lower(email) = v_email
    limit 1;
    if v_contact is null and v_name is not null then
      insert into public.contacts (company_id, full_name, email, phone, contact_type, kind, notes)
      values (
        q.company_id,
        left(v_name, 200),
        v_email,
        nullif(btrim(coalesce(p_contact->>'phone', '')), ''),
        'primary',
        'business',
        'Added from quote checkout.'
      )
      returning id into v_contact;
    end if;
  end if;

  v_owner := q.owner_id;
  if v_owner is null or not exists (select 1 from public.profiles where id = v_owner) then
    v_owner := v_company.owner_id;
  end if;
  if v_owner is null then
    select id into v_owner
    from public.profiles
    where role = 'admin' and is_active
    order by created_at
    limit 1;
  end if;
  if v_owner is null then
    raise exception 'No account owner is available for this order';
  end if;

  select coalesce(sum(qi.line_total), 0)
    into v_subtotal
  from public.quotation_items qi
  where qi.quotation_id = q.id
    and qi.client_response = 'accepted';

  -- line_total is pre-tax and already includes the quotation discount. Tax is added once.
  v_discount := 0;
  v_tax := round(v_subtotal * coalesce(q.tax_percent, 0) / 100.0, 2);
  v_total := v_subtotal + v_tax;

  select coalesce(sum(coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62) * qi.quantity), 0)
    into v_cost
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and qi.client_response = 'accepted'
    and p.status = 'active';

  v_delivery := current_date + 21;
  if q.requirement_id is not null then
    select coalesce(r.deadline, v_delivery)
      into v_delivery
    from public.requirements r
    where r.id = q.requirement_id;
  end if;

  select id into v_ops from public.departments where slug = 'operations' limit 1;

  insert into public.orders (
    order_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id, source
  ) values (
    public.next_order_number(),
    q.company_id,
    v_contact,
    q.id,
    q.requirement_id,
    v_owner,
    v_total,
    v_delivery,
    'created',
    v_ops,
    'Confirm PO and assign operations',
    v_cost,
    v_cost,
    v_total - v_cost,
    q.campaign_id,
    'business'
  )
  returning id into v_order_id;
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order_id, null, 'created', v_owner, 'business');


  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price,
         qi.line_total
  from public.quotation_items qi
  join public.products p on p.id = qi.product_id
  where qi.quotation_id = q.id
    and qi.client_response = 'accepted'
    and p.status = 'active';

  insert into public.order_assignments (order_id, department_id, assigned_by, note)
  values (
    v_order_id,
    v_ops,
    v_owner,
    'Store checkout from business quote ' || coalesce(q.quotation_number, q.id::text)
  );

  insert into public.tasks (title, order_id, department_id, created_by, due_at, description)
  values (
    'Confirm PO and assign operations',
    v_order_id,
    v_ops,
    v_owner,
    current_date + 1,
    'Store checkout from business quote ' || coalesce(q.quotation_number, q.id::text)
  );

  if q.requirement_id is not null then
    update public.requirements set status = 'won', updated_at = now() where id = q.requirement_id;
  end if;

  update public.quote_checkout_tokens
  set used_at = now(),
      order_id = v_order_id
  where id = t.id;

  perform public.notify_users(
    'internal',
    q.company_id,
    'Quote checkout completed',
    'Store checkout from business quote ' || coalesce(q.quotation_number, ''),
    '/crm/orders/' || v_order_id::text
  );
  perform public.notify_users(
    'client',
    q.company_id,
    'Your order is confirmed',
    'We have started fulfilment for the quoted lines you checked out.',
    '/business/orders/' || v_order_id::text
  );

  return v_order_id;
end;
$$;

notify pgrst, 'reload schema';

commit;
