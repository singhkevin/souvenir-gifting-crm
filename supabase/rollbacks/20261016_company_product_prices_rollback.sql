-- Rolls back 20261016_company_product_prices.sql.
-- Restores client_products and place_direct_order to the previous definitions.
-- Does not drop contacts.kind (it may have existed before this migration).
-- Restoring the margin check fails if a negative margin was saved. Clear those rows first.

begin;

drop policy if exists company_product_prices_client_read on public.company_product_prices;
drop policy if exists company_product_prices_staff on public.company_product_prices;
drop table if exists public.company_product_prices;

drop function if exists public.listed_unit_price(uuid, uuid, numeric, numeric, numeric);

create or replace view public.client_products as
select
  p.id,
  p.name,
  p.sku,
  p.description,
  p.image_url,
  case
    when coalesce((select s.portal_show_sell_price from public.org_settings s limit 1), true) is false then null
    else public.resolved_sell_price(
      case
        when coalesce((select s.portal_use_best_cost from public.org_settings s limit 1), false)
        then coalesce((
          select o.cost
          from public.product_supplier_offers o
          where o.product_id = p.id
            and o.is_active
            and (
              not coalesce((select s.best_cost_require_in_stock from public.org_settings s limit 1), true)
              or o.in_stock
            )
            and (p.moq is null or p.moq <= 0 or o.moq <= p.moq)
          order by o.is_preferred desc, o.cost asc, o.lead_time_days asc nulls last, o.created_at asc
          limit 1
        ), (select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id))
        else (select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id)
      end,
      p.price,
      (select pc.internal_margin from public.product_costs pc where pc.product_id = p.id),
      (select c.margin_percent from public.companies c where c.id = public.client_company_id()),
      'b2b'
    )
  end as price,
  p.moq,
  p.stock_qty,
  p.fulfillment_mode,
  p.category_id,
  cat.name as category_name,
  p.subcategory_id,
  sub.name as subcategory_name,
  p.brand_id,
  b.name as brand_name
from public.products p
left join public.categories cat on cat.id = p.category_id
left join public.subcategories sub on sub.id = p.subcategory_id
left join public.brands b on b.id = p.brand_id
where p.status = 'active'
  and p.catalogue_access <> 'none'
  and (
    p.catalogue_access = 'all'
    or exists (
      select 1
      from public.company_product_access cpa
      where cpa.product_id = p.id
        and cpa.company_id = public.client_company_id()
    )
  )
  and not exists (
    select 1
    from public.company_product_exclusions cpe
    where cpe.product_id = p.id
      and cpe.company_id = public.client_company_id()
  );

create or replace function public.place_direct_order(
  p_company_id uuid,
  p_contact_id uuid,
  p_owner_id uuid,
  p_surface text,
  p_campaign_id uuid,
  p_lines jsonb,
  p_source text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  -- auth.role() is the JWT role. current_user is the function owner inside this
  -- security definer body, so it must not be used to detect the service role.
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_owner uuid;
  v_contact uuid;
  v_campaign uuid;
  v_company_margin numeric;
  v_show boolean := true;
  v_use_best boolean := false;
  v_require_stock boolean := true;
  v_channel text;
  v_ops uuid;
  v_order_id uuid;
  v_number text;
  v_total numeric := 0;
  v_cost numeric := 0;
  v_notes text;
  v_elem jsonb;
  v_product public.products%rowtype;
  v_qty integer;
  v_stock integer;
  v_mode text;
  v_unit numeric;
  v_unit_cost numeric;
  v_price_count integer;
  v_price_min numeric;
  v_price_max numeric;
  v_line_count integer := 0;
  v_source text;
begin
  if p_company_id is null then
    raise exception 'Company not found';
  end if;

  if p_surface = 'store' then
    if not v_service then
      raise exception 'Not permitted to place this order';
    end if;
  elsif p_surface in ('portal', 'microsite', 'catalog') then
    if not v_service then
      if not public.is_client() then
        raise exception 'Not permitted to place this order';
      end if;
      if p_company_id is distinct from public.client_company_id() then
        raise exception 'Not permitted to place this order';
      end if;
    end if;
  else
    raise exception 'Invalid purchase surface';
  end if;

  if p_source is not null and btrim(p_source) <> '' then
    if p_source not in ('store', 'business', 'portal', 'microsite', 'crm') then
      raise exception 'Invalid order source';
    end if;
    if not v_service and p_source not in ('portal', 'microsite') then
      raise exception 'Not permitted to set this order source';
    end if;
    v_source := p_source;
  elsif auth.uid() is null then
    v_source := 'store';
  else
    v_source := 'portal';
  end if;

  if not exists (select 1 from public.companies where id = p_company_id) then
    raise exception 'Company not found';
  end if;

  if p_surface = 'catalog' then
    if p_campaign_id is null then
      raise exception 'Catalog purchase needs a catalog';
    end if;
    if not exists (
      select 1 from public.catalog_assignments a
      where a.campaign_id = p_campaign_id and a.company_id = p_company_id
    ) and not exists (
      select 1 from public.campaigns c
      where c.id = p_campaign_id and c.company_id = p_company_id
    ) then
      raise exception 'This catalog is not assigned to your company';
    end if;
    v_campaign := p_campaign_id;
  else
    v_campaign := null;
  end if;

  if jsonb_typeof(p_lines) is distinct from 'array'
     or jsonb_array_length(p_lines) < 1
     or jsonb_array_length(p_lines) > 50 then
    raise exception 'Choose between 1 and 50 products';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_lines) as lines(value)
  ) <> (
    select count(distinct lines.value->>'product_id')
    from jsonb_array_elements(p_lines) as lines(value)
  ) then
    raise exception 'Each product can appear only once';
  end if;

  v_contact := p_contact_id;
  if v_contact is not null and not exists (
    select 1 from public.contacts c
    where c.id = v_contact and c.company_id = p_company_id
  ) then
    v_contact := null;
  end if;

  v_owner := p_owner_id;
  if v_owner is null or not exists (select 1 from public.profiles where id = v_owner) then
    select owner_id into v_owner from public.companies where id = p_company_id;
  end if;
  if v_owner is null or not exists (select 1 from public.profiles where id = v_owner) then
    select id into v_owner
    from public.profiles
    where role = 'admin' and is_active = true
    order by created_at
    limit 1;
  end if;
  if v_owner is null then
    raise exception 'No account owner is available for this order';
  end if;

  select margin_percent into v_company_margin
  from public.companies
  where id = p_company_id;

  if p_surface = 'store' then
    select
      coalesce(store_show_sell_price, true),
      coalesce(store_use_best_cost, false),
      coalesce(best_cost_require_in_stock, true)
      into v_show, v_use_best, v_require_stock
    from public.org_settings
    limit 1;
    v_channel := 'b2c';
    v_company_margin := null;
  elsif p_surface = 'microsite' then
    select
      coalesce(microsite_show_sell_price, true),
      coalesce(microsite_use_best_cost, false),
      coalesce(best_cost_require_in_stock, true)
      into v_show, v_use_best, v_require_stock
    from public.org_settings
    limit 1;
    v_channel := 'b2b';
  elsif p_surface in ('portal', 'catalog') then
    select
      coalesce(portal_show_sell_price, true),
      coalesce(portal_use_best_cost, false),
      coalesce(best_cost_require_in_stock, true)
      into v_show, v_use_best, v_require_stock
    from public.org_settings
    limit 1;
    v_channel := 'b2b';
  end if;

  v_show := coalesce(v_show, true);
  v_use_best := coalesce(v_use_best, false);
  v_require_stock := coalesce(v_require_stock, true);
  -- A catalog line was always buyable at its catalog price; the portal "show sell price" switch
  -- does not hide catalog prices.
  if p_surface = 'catalog' then
    v_show := true;
  end if;

  create temporary table _direct_lines (
    product_id uuid primary key,
    quantity integer not null,
    unit_price numeric not null,
    unit_cost numeric,
    description text not null
  ) on commit drop;

  for v_elem in
    select lines.value
    from jsonb_array_elements(p_lines) as lines(value)
    order by lines.value->>'product_id'
  loop
    if (v_elem->>'product_id') is null or (v_elem->>'quantity') is null then
      raise exception 'Choose a product and a whole-number quantity';
    end if;
    if (v_elem->>'quantity') !~ '^[0-9]+$' then
      raise exception 'Quantity must be a whole number from 1 to 100000';
    end if;
    if (v_elem->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'A product in this order is no longer available';
    end if;

    v_qty := (v_elem->>'quantity')::integer;
    if v_qty < 1 or v_qty > 100000 then
      raise exception 'Quantity must be a whole number from 1 to 100000';
    end if;

    select * into v_product
    from public.products
    where id = (v_elem->>'product_id')::uuid
    for update;

    if not found then
      raise exception 'A product in this order is no longer available';
    end if;
    if v_product.status <> 'active' then
      raise exception '% is not available to buy', v_product.name;
    end if;

    v_mode := coalesce(v_product.fulfillment_mode, 'auto');
    v_stock := coalesce(v_product.stock_qty, 0);

    if p_surface = 'store' then
      if v_product.status <> 'active' or v_product.catalogue_access <> 'all' then
        raise exception '% is not available to buy', v_product.name;
      end if;
    elsif p_surface in ('portal', 'microsite') then
      if v_product.status <> 'active'
         or v_product.catalogue_access = 'none'
         or (
           v_product.catalogue_access <> 'all'
           and not exists (
             select 1 from public.company_product_access cpa
             where cpa.product_id = v_product.id and cpa.company_id = p_company_id
           )
         )
         or exists (
           select 1 from public.company_product_exclusions cpe
           where cpe.product_id = v_product.id and cpe.company_id = p_company_id
         )
      then
        raise exception '% is not available to buy', v_product.name;
      end if;
    end if;

    v_unit := null;
    v_unit_cost := null;

    if p_surface = 'catalog' then
      -- manual_price is the explicit per-line override. Pack options keep their stored price.
      -- Everything else is priced below from cost and the buying company's margin.
      select count(*),
             min(case when cp.pack_option is not null then cp.selling_price else cp.manual_price end),
             max(case when cp.pack_option is not null then cp.selling_price else cp.manual_price end)
        into v_price_count, v_price_min, v_price_max
      from public.campaign_products cp
      where cp.campaign_id = v_campaign
        and cp.product_id = v_product.id
        and cp.visibility = 'published'
        and cp.pack_kit_id is null;

      if coalesce(v_price_count, 0) = 0 then
        raise exception '% is available by quote', v_product.name;
      end if;
      if v_price_min is distinct from v_price_max then
        raise exception '% is listed at more than one catalog price', v_product.name;
      end if;
      v_unit := v_price_min;
    end if;

    if v_unit is null and v_show then
      v_unit_cost := case
        when v_use_best then coalesce((
          select o.cost
          from public.product_supplier_offers o
          where o.product_id = v_product.id
            and o.is_active
            and (not v_require_stock or o.in_stock)
            and (v_product.moq is null or v_product.moq <= 0 or o.moq <= v_product.moq)
          order by o.is_preferred desc, o.cost asc, o.lead_time_days asc nulls last, o.created_at asc
          limit 1
        ), (select pc.supplier_cost from public.product_costs pc where pc.product_id = v_product.id))
        else (select pc.supplier_cost from public.product_costs pc where pc.product_id = v_product.id)
      end;
      v_unit := public.resolved_sell_price(
        v_unit_cost,
        v_product.price,
        (select pc.internal_margin from public.product_costs pc where pc.product_id = v_product.id),
        v_company_margin,
        v_channel
      );
    end if;

    if v_mode = 'rfq' or v_unit is null then
      raise exception '% is available by quote', v_product.name;
    end if;

    if v_mode = 'buy' and v_stock = 0 then
      null;
    elsif v_stock > 0 and v_mode in ('auto', 'buy') then
      if v_qty > v_stock then
        raise exception '% has % in stock. Lower the quantity or request a quote for more', v_product.name, v_stock;
      end if;
      update public.products
      set stock_qty = stock_qty - v_qty,
          updated_at = now()
      where id = v_product.id
        and stock_qty >= v_qty;
      if not found then
        raise exception 'Stock changed for %. Refresh and try again', v_product.name;
      end if;
    else
      raise exception '% is available by quote', v_product.name;
    end if;

    if v_unit_cost is null then
      v_unit_cost := (select pc.supplier_cost from public.product_costs pc where pc.product_id = v_product.id);
    end if;

    insert into _direct_lines (product_id, quantity, unit_price, unit_cost, description)
    values (v_product.id, v_qty, v_unit, v_unit_cost, v_product.name);

    v_line_count := v_line_count + 1;
  end loop;

  if v_line_count < 1 then
    raise exception 'Choose between 1 and 50 products';
  end if;

  select coalesce(sum(round(quantity * unit_price, 2)), 0),
         coalesce(sum(coalesce(unit_cost, 0) * quantity), 0)
    into v_total, v_cost
  from _direct_lines;

  select id into v_ops from public.departments where slug = 'operations' limit 1;
  v_number := public.next_order_number();
  v_notes := case p_surface
    when 'store' then 'Direct purchase from the public catalogue.'
    when 'microsite' then 'Direct purchase from the company microsite.'
    when 'catalog' then 'Direct purchase from a catalog.'
    else 'Direct purchase from the company catalogue.'
  end;

  insert into public.orders (
    order_number, po_number, company_id, contact_id, quotation_id, requirement_id, owner_id,
    order_value, expected_delivery_date, status, current_department_id, next_action,
    product_cost, total_cost, gross_profit, campaign_id, notes, source
  ) values (
    v_number, v_number, p_company_id, v_contact, null, null, v_owner,
    v_total, current_date + 21, 'created', v_ops, 'Confirm PO and assign operations',
    v_cost, v_cost, v_total - v_cost, v_campaign, v_notes, v_source
  ) returning id into v_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (v_order_id, null, 'created', coalesce(auth.uid(), v_owner), v_source);

  insert into public.order_items (order_id, product_id, description, quantity, unit_price, line_total)
  select v_order_id, product_id, description, quantity, unit_price, round(quantity * unit_price, 2)
  from _direct_lines;

  if v_ops is not null then
    insert into public.order_assignments (order_id, department_id, assigned_by, note)
    values (v_order_id, v_ops, coalesce(auth.uid(), v_owner), 'Direct purchase received');

    insert into public.tasks (title, order_id, department_id, created_by, due_at, description)
    values (
      'Confirm order and assign operations',
      v_order_id,
      v_ops,
      coalesce(auth.uid(), v_owner),
      current_date + 1,
      'New order from a direct purchase'
    );
  end if;

  if v_campaign is not null then
    perform public.record_campaign_event(
      v_campaign,
      'order_created',
      jsonb_build_object('order_id', v_order_id, 'source', 'direct_purchase')
    );
  end if;

  perform public.notify_users(
    'internal',
    p_company_id,
    'New order from a direct purchase',
    'A shopper bought in-stock or flagged products without a quotation.',
    '/crm/orders/' || v_order_id::text
  );
  perform public.notify_users(
    'client',
    p_company_id,
    'Your order is confirmed',
    'We have started fulfilment for the items you bought.',
    '/portal/orders'
  );

  return v_order_id;
end;
$$;

grant execute on function public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb, text) to authenticated;
grant execute on function public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb, text) to service_role;

alter table public.quotation_item_costs
  drop constraint if exists quotation_item_costs_margin_percent_check;
alter table public.quotation_item_costs
  add constraint quotation_item_costs_margin_percent_check
  check (margin_percent is null or margin_percent >= 0);

alter table public.org_settings drop column if exists public_contact_phone;

comment on column public.campaign_products.pack_option is
  'When set, groups auto-generated budget pack choices for client comparison (A/B/C).';
comment on column public.campaign_products.pack_kit_id is
  'Groups multiple products into one budget pack option (A/B/C).';
comment on column public.campaign_products.pack_kit_role is
  'primary = client-facing kit card & shortlist target; line = included item.';
comment on column public.campaign_products.pack_kit_total is
  'On primary kit row only: combined per-person price for the whole kit.';
comment on column public.campaign_products.priced_company_id is
  'Company a budget pack was priced against when generated. Pack prices are stored, not recomputed per viewer.';
comment on column public.campaign_products.manual_price is
  'Explicit client price for this line, the same for every company. Null = resolve from cost and the viewing company margin.';

create or replace function public.register_business_account(
  p_company jsonb,
  p_contact jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_owner uuid;
  v_company_id uuid;
  v_contact_id uuid;
  v_name text;
  v_contact_name text;
  v_email text;
begin
  if not v_service then
    raise exception 'Not permitted';
  end if;

  v_name := nullif(btrim(coalesce(p_company->>'legal_name', '')), '');
  v_contact_name := nullif(btrim(coalesce(p_contact->>'full_name', '')), '');
  v_email := nullif(lower(btrim(coalesce(p_contact->>'email', ''))), '');
  if v_name is null or v_contact_name is null or v_email is null or position('@' in v_email) < 2 then
    raise exception 'A legal name, contact name, and email are required';
  end if;

  select s.business_default_owner_id
    into v_owner
  from public.org_settings s
  join public.profiles p on p.id = s.business_default_owner_id and p.is_active
  limit 1;

  if v_owner is null then
    select id
      into v_owner
    from public.profiles
    where role = 'admin'
      and is_active
    order by created_at
    limit 1;
  end if;

  if v_owner is null then
    raise exception 'No account owner is available for a business account';
  end if;

  insert into public.companies (
    name,
    status,
    account_type,
    business_verification,
    owner_id,
    gst_number,
    city,
    state,
    country,
    website,
    notes
  ) values (
    left(v_name, 200),
    'prospect',
    'business',
    'unverified',
    v_owner,
    nullif(btrim(coalesce(p_company->>'gst_number', '')), ''),
    nullif(btrim(coalesce(p_company->>'city', '')), ''),
    nullif(btrim(coalesce(p_company->>'state', '')), ''),
    coalesce(nullif(btrim(coalesce(p_company->>'country', '')), ''), 'India'),
    nullif(btrim(coalesce(p_company->>'website', '')), ''),
    nullif(btrim(coalesce(p_company->>'notes', '')), '')
  )
  returning id into v_company_id;

  insert into public.contacts (
    company_id,
    full_name,
    email,
    phone,
    contact_type,
    kind,
    notes
  ) values (
    v_company_id,
    left(v_contact_name, 200),
    v_email,
    nullif(btrim(coalesce(p_contact->>'phone', '')), ''),
    'primary',
    'business',
    'Registered a business account.'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    owner_id,
    source,
    stage,
    notes
  ) values (
    v_company_id,
    v_contact_id,
    v_owner,
    'website',
    'cold',
    'Opened from business self-registration.'
  );

  return v_company_id;
end;
$$;

revoke all on function public.register_business_account(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.register_business_account(jsonb, jsonb) to service_role;

-- Restore the original contacts_kind_check (corporate/direct only).
-- Self-registered rows are moved to direct first so the check can be re-added.
update public.contacts set kind = 'direct' where kind = 'business';
alter table public.contacts drop constraint if exists contacts_kind_check;
alter table public.contacts
  add constraint contacts_kind_check
  check (kind in ('corporate', 'direct'));

commit;
