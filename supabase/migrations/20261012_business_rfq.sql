-- Business quote basket → requirement.
-- Idempotent on (company_id, client_request_id). Does not create a quotation or an order.

alter table public.requirements
  add column if not exists source text not null default 'staff',
  add column if not exists client_request_id text;

alter table public.requirements drop constraint if exists requirements_source_check;
alter table public.requirements
  add constraint requirements_source_check
  check (source in ('staff', 'corporate_portal', 'business_portal', 'website'));

create unique index if not exists requirements_company_client_request_id_key
  on public.requirements (company_id, client_request_id)
  where client_request_id is not null;

comment on column public.requirements.source is
  'staff, corporate_portal, business_portal, or website.';
comment on column public.requirements.client_request_id is
  'Caller-supplied idempotency id. Unique per company when set.';

alter table public.requirement_products
  add column if not exists notes text,
  add column if not exists target_unit_price numeric,
  add column if not exists alt_quantities integer[];

alter table public.requirement_products drop constraint if exists requirement_products_target_unit_price_check;
alter table public.requirement_products
  add constraint requirement_products_target_unit_price_check
  check (target_unit_price is null or target_unit_price >= 0);

create or replace function public.business_submit_rfq(
  p_client_request_id text,
  p_lines jsonb,
  p_deadline date default null,
  p_delivery_city text default null,
  p_budget numeric default null,
  p_purpose text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.business_company_id();
  v_owner uuid;
  v_request text := nullif(btrim(coalesce(p_client_request_id, '')), '');
  v_existing uuid;
  v_requirement uuid;
  v_count integer := 0;
  v_elem jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_moq integer;
  v_alt integer[];
  v_alt_count integer;
  v_target numeric;
  v_first_name text;
  v_name text;
  v_seen uuid[] := '{}'::uuid[];
  v_product_id uuid;
begin
  if not public.is_business() or v_company is null then
    raise exception 'Only a business account can submit this request';
  end if;
  if v_request is null or v_request !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'A request id is required';
  end if;
  if p_budget is not null and p_budget < 0 then
    raise exception 'Budget cannot be negative';
  end if;
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'Add between 1 and 50 products';
  end if;

  select id into v_existing
  from public.requirements
  where company_id = v_company
    and client_request_id = v_request;
  if v_existing is not null then
    return v_existing;
  end if;

  if not exists (
    select 1
    from public.companies c
    where c.id = v_company
      and c.business_verification = 'verified'
  ) then
    raise exception 'Your account is pending approval';
  end if;

  select owner_id into v_owner from public.companies where id = v_company;
  if v_owner is null or not exists (select 1 from public.profiles where id = v_owner and is_active) then
    select id into v_owner
    from public.profiles
    where role = 'admin' and is_active
    order by created_at
    limit 1;
  end if;
  if v_owner is null then
    raise exception 'No account owner is available for this request';
  end if;

  drop table if exists _business_rfq_lines;
  create temporary table _business_rfq_lines (
    product_id uuid primary key,
    quantity integer not null,
    alt_quantities integer[],
    target_unit_price numeric,
    note text,
    product_name text not null
  ) on commit drop;

  for v_elem in
    select value from jsonb_array_elements(p_lines)
  loop
    v_count := v_count + 1;
    if v_count > 50 then
      raise exception 'Add between 1 and 50 products';
    end if;
    if (v_elem->>'product_id') is null
       or (v_elem->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'A product in this request is no longer available';
    end if;
    if (v_elem->>'quantity') is null or (v_elem->>'quantity') !~ '^[0-9]+$' then
      raise exception 'Quantity must be a whole number from the MOQ to 100000';
    end if;

    v_product_id := (v_elem->>'product_id')::uuid;
    if v_product_id = any (v_seen) then
      raise exception 'Each product can appear only once';
    end if;
    v_seen := v_seen || v_product_id;

    select * into v_product
    from public.products
    where id = v_product_id;
    if not found or v_product.status <> 'active' or v_product.catalogue_access <> 'all' then
      raise exception 'A product in this request is no longer available';
    end if;

    v_qty := (v_elem->>'quantity')::integer;
    v_moq := greatest(coalesce(v_product.moq, 1), 1);
    if v_qty < v_moq or v_qty > 100000 then
      raise exception 'Quantity for % must be between % and 100000', v_product.name, v_moq;
    end if;

    v_alt := null;
    if v_elem ? 'alt_quantities' and jsonb_typeof(v_elem->'alt_quantities') = 'array' then
      select coalesce(array_agg(distinct q), '{}'::integer[])
        into v_alt
      from (
        select (value #>> '{}')::integer as q
        from jsonb_array_elements(v_elem->'alt_quantities')
        where (value #>> '{}') ~ '^[0-9]+$'
      ) parsed
      where q >= v_moq and q <= 100000 and q <> v_qty;
      v_alt_count := coalesce(cardinality(v_alt), 0);
      if v_alt_count > 3 or jsonb_array_length(v_elem->'alt_quantities') > 3 then
        raise exception 'Each product can have at most 3 quantity breaks';
      end if;
      if v_alt_count = 0 then
        v_alt := null;
      end if;
    end if;

    v_target := null;
    if nullif(btrim(coalesce(v_elem->>'target_unit_price', '')), '') is not null then
      if (v_elem->>'target_unit_price') !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception 'Target price must be zero or more';
      end if;
      v_target := (v_elem->>'target_unit_price')::numeric;
    end if;

    if v_first_name is null then
      v_first_name := v_product.name;
    end if;

    insert into _business_rfq_lines (product_id, quantity, alt_quantities, target_unit_price, note, product_name)
    values (
      v_product.id,
      v_qty,
      v_alt,
      v_target,
      nullif(left(btrim(coalesce(v_elem->>'note', '')), 500), ''),
      v_product.name
    );
  end loop;

  if v_count < 1 then
    raise exception 'Add between 1 and 50 products';
  end if;

  v_name := 'Business RFQ: ' || coalesce(v_first_name, 'items');
  if v_count > 1 then
    v_name := v_name || ' +' || (v_count - 1)::text;
  end if;

  begin
    insert into public.requirements (
      name,
      company_id,
      owner_id,
      quantity,
      budget,
      deadline,
      delivery_city,
      purpose,
      description,
      status,
      source,
      client_request_id
    ) values (
      left(v_name, 180),
      v_company,
      v_owner,
      (select coalesce(sum(quantity), 0) from _business_rfq_lines),
      p_budget,
      p_deadline,
      nullif(left(btrim(coalesce(p_delivery_city, '')), 120), ''),
      nullif(left(btrim(coalesce(p_purpose, '')), 120), ''),
      nullif(left(btrim(coalesce(p_notes, '')), 4000), ''),
      'active',
      'business_portal',
      v_request
    )
    returning id into v_requirement;
  exception
    when unique_violation then
      select id into v_existing
      from public.requirements
      where company_id = v_company
        and client_request_id = v_request;
      if v_existing is not null then
        return v_existing;
      end if;
      raise;
  end;

  insert into public.requirement_products (
    requirement_id,
    product_id,
    quantity,
    notes,
    target_unit_price,
    alt_quantities
  )
  select v_requirement, product_id, quantity, note, target_unit_price, alt_quantities
  from _business_rfq_lines;

  update public.leads
  set stage = 'warm',
      updated_at = now()
  where company_id = v_company
    and stage = 'cold';

  perform public.notify_users(
    'internal',
    v_company,
    'New business quote request',
    v_name,
    '/crm/requirements/' || v_requirement::text
  );

  return v_requirement;
end;
$$;

revoke all on function public.business_submit_rfq(text, jsonb, date, text, numeric, text, text) from public, anon;
grant execute on function public.business_submit_rfq(text, jsonb, date, text, numeric, text, text) to authenticated;

comment on function public.business_submit_rfq(text, jsonb, date, text, numeric, text, text) is
  'Idempotent business RFQ. One requirement per client request id. Public catalogue products only.';
