-- Quote-locked store checkout for an accepted business quotation.
-- orders.quotation_id is already unique in this project (orders_quotation_id_key).
-- This migration adds that unique index only when neither a constraint nor a unique
-- index exists, and only after checking for duplicate non-null quotation ids.
-- quote_checkout_tokens has RLS on and no client policies.

create table if not exists public.quote_checkout_tokens (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id),
  company_id uuid not null references public.companies (id),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  order_id uuid references public.orders (id),
  created_at timestamptz not null default now()
);

create index if not exists quote_checkout_tokens_quotation_id_idx
  on public.quote_checkout_tokens (quotation_id);

alter table public.quote_checkout_tokens enable row level security;
revoke all on table public.quote_checkout_tokens from public, anon, authenticated;
grant all on table public.quote_checkout_tokens to service_role;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%quotation_id%'
  ) or exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'orders'
      and indexdef ilike '%unique%'
      and indexdef ilike '%quotation_id%'
  ) then
    raise notice 'orders.quotation_id is already unique; leaving the existing constraint in place';
  elsif exists (
    select 1
    from public.orders
    where quotation_id is not null
    group by quotation_id
    having count(*) > 1
  ) then
    raise exception 'duplicate orders.quotation_id rows exist; resolve them before applying 20261012_quote_checkout.sql';
  else
    execute 'create unique index if not exists orders_quotation_id_unique on public.orders (quotation_id) where quotation_id is not null';
  end if;
end $$;

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

  select coalesce(sum(round(qi.quantity * qi.unit_price, 2)), 0)
    into v_subtotal
  from public.quotation_items qi
  where qi.quotation_id = q.id
    and qi.client_response = 'accepted';

  v_discount := round(v_subtotal * coalesce(q.discount_percent, 0) / 100.0, 2);
  v_tax := round((v_subtotal - v_discount) * coalesce(q.tax_percent, 0) / 100.0, 2);
  v_total := v_subtotal - v_discount + v_tax;

  -- Replaced by 20261013_product_costs.sql, which reads product_costs before these columns are dropped.
  select coalesce(sum(coalesce(p.supplier_cost, p.price * 0.62) * qi.quantity), 0)
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
    product_cost, total_cost, gross_profit, campaign_id
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
    q.campaign_id
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, qi.product_id, coalesce(qi.description, p.name), qi.quantity, qi.unit_price,
         round(qi.quantity * qi.unit_price, 2)
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

revoke all on function public.place_quote_order(text, jsonb) from public, anon, authenticated;
grant execute on function public.place_quote_order(text, jsonb) to service_role;

comment on function public.place_quote_order(text, jsonb) is
  'Single-use quote checkout. Builds one order from accepted lines at the quoted price. A repeat returns the existing order.';

-- Accepted lines are the checkout price. Block later inserts, edits, and deletes.
create or replace function public.guard_accepted_quotation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quotation_id uuid := case when tg_op = 'DELETE' then old.quotation_id else new.quotation_id end;
  v_status text;
begin
  select q.status
    into v_status
  from public.quotations q
  where q.id = v_quotation_id;

  if v_status = 'accepted' then
    raise exception 'Accepted quotation lines are locked';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_accepted_quotation_items() from public, anon;
grant execute on function public.guard_accepted_quotation_items() to authenticated, service_role;

drop trigger if exists quotation_items_lock_accepted on public.quotation_items;
create trigger quotation_items_lock_accepted
  before insert or update or delete on public.quotation_items
  for each row
  execute function public.guard_accepted_quotation_items();
