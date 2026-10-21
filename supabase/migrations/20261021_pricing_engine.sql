-- One pricing engine for the store, business portal, and corporate portal.
-- Do not apply from the agent. Apply this file before 20261021_clear_rupee_internal_margin.sql.
-- The optional margin file is separate: Kevin applies it only if he wants those values cleared.
--
-- Seeded so that, with no edits, prices match the previous ladder:
--   store: products.price, not cost
--   business and corporate: company special, then catalog manual (corporate only),
--     then retail plus the company margin. Portal margins are null.
--   rounding: paise (same as round(..., 2))
--   GST mode is a label. Store and direct purchases still add no GST. Quotes still use tax_percent.
-- Existing quotations, orders, and accepted lines are not rewritten.

begin;

create or replace function public.is_pricing_editor()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'accounts')
  );
$$;

create or replace function public.is_pricing_viewer()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'accounts', 'management', 'sales')
  );
$$;

revoke all on function public.is_pricing_editor() from public;
grant execute on function public.is_pricing_editor() to authenticated;
revoke all on function public.is_pricing_viewer() from public;
grant execute on function public.is_pricing_viewer() to authenticated;

alter table public.org_settings
  add column if not exists store_margin_percent numeric,
  add column if not exists store_price_base text not null default 'retail',
  add column if not exists store_no_cost_fallback text not null default 'retail_margin',
  add column if not exists store_rounding text not null default 'none',
  add column if not exists store_gst_mode text not null default 'inclusive',
  add column if not exists store_min_margin_percent numeric not null default 0,
  add column if not exists business_margin_percent numeric,
  add column if not exists business_price_base text not null default 'retail',
  add column if not exists business_no_cost_fallback text not null default 'retail_margin',
  add column if not exists business_rounding text not null default 'none',
  add column if not exists business_gst_mode text not null default 'exclusive',
  add column if not exists business_min_margin_percent numeric not null default 0,
  add column if not exists corporate_margin_percent numeric,
  add column if not exists corporate_price_base text not null default 'retail',
  add column if not exists corporate_no_cost_fallback text not null default 'retail_margin',
  add column if not exists corporate_rounding text not null default 'none',
  add column if not exists corporate_gst_mode text not null default 'exclusive',
  add column if not exists corporate_min_margin_percent numeric not null default 0;

alter table public.org_settings drop constraint if exists org_settings_store_price_base_check;
alter table public.org_settings drop constraint if exists org_settings_business_price_base_check;
alter table public.org_settings drop constraint if exists org_settings_corporate_price_base_check;
alter table public.org_settings drop constraint if exists org_settings_store_no_cost_fallback_check;
alter table public.org_settings drop constraint if exists org_settings_business_no_cost_fallback_check;
alter table public.org_settings drop constraint if exists org_settings_corporate_no_cost_fallback_check;
alter table public.org_settings drop constraint if exists org_settings_store_rounding_check;
alter table public.org_settings drop constraint if exists org_settings_business_rounding_check;
alter table public.org_settings drop constraint if exists org_settings_corporate_rounding_check;
alter table public.org_settings drop constraint if exists org_settings_store_gst_mode_check;
alter table public.org_settings drop constraint if exists org_settings_business_gst_mode_check;
alter table public.org_settings drop constraint if exists org_settings_corporate_gst_mode_check;
alter table public.org_settings drop constraint if exists org_settings_store_min_margin_percent_check;
alter table public.org_settings drop constraint if exists org_settings_business_min_margin_percent_check;
alter table public.org_settings drop constraint if exists org_settings_corporate_min_margin_percent_check;

alter table public.org_settings
  add constraint org_settings_store_price_base_check check (store_price_base in ('retail', 'cost')),
  add constraint org_settings_business_price_base_check check (business_price_base in ('retail', 'cost')),
  add constraint org_settings_corporate_price_base_check check (corporate_price_base in ('retail', 'cost')),
  add constraint org_settings_store_no_cost_fallback_check check (store_no_cost_fallback in ('retail_margin', 'on_quote')),
  add constraint org_settings_business_no_cost_fallback_check check (business_no_cost_fallback in ('retail_margin', 'on_quote')),
  add constraint org_settings_corporate_no_cost_fallback_check check (corporate_no_cost_fallback in ('retail_margin', 'on_quote')),
  add constraint org_settings_store_rounding_check check (store_rounding in ('none', 'whole', 'end9', 'end99')),
  add constraint org_settings_business_rounding_check check (business_rounding in ('none', 'whole', 'end9', 'end99')),
  add constraint org_settings_corporate_rounding_check check (corporate_rounding in ('none', 'whole', 'end9', 'end99')),
  add constraint org_settings_store_gst_mode_check check (store_gst_mode in ('inclusive', 'exclusive')),
  add constraint org_settings_business_gst_mode_check check (business_gst_mode in ('inclusive', 'exclusive')),
  add constraint org_settings_corporate_gst_mode_check check (corporate_gst_mode in ('inclusive', 'exclusive')),
  add constraint org_settings_store_min_margin_percent_check check (store_min_margin_percent >= 0),
  add constraint org_settings_business_min_margin_percent_check check (business_min_margin_percent >= 0),
  add constraint org_settings_corporate_min_margin_percent_check check (corporate_min_margin_percent >= 0);

comment on column public.org_settings.store_price_base is
  'retail: store uses products.price as-is. cost: store price is cost plus store_margin_percent.';
comment on column public.org_settings.store_gst_mode is
  'Label only. inclusive matches today: the store price is the amount paid and checkout adds no GST.';
comment on column public.org_settings.business_gst_mode is
  'Label only. exclusive matches quotes, which add quotations.tax_percent. Direct purchases still add no GST.';
comment on column public.org_settings.corporate_gst_mode is
  'Label only. exclusive matches quotes. Portal and catalog direct purchases still add no GST.';
comment on column public.product_costs.supplier_cost is
  'Cost price. The only cost the pricing engine reads.';
comment on column public.product_costs.internal_margin is
  'Retired. Not read by the pricing engine. The optional 20261021_clear_rupee_internal_margin migration nulls rupee-like values.';

create table if not exists public.portal_product_prices (
  product_id uuid not null references public.products (id) on delete cascade,
  portal text not null check (portal in ('store', 'business', 'corporate')),
  price numeric not null check (price >= 0),
  valid_until date,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, portal)
);

comment on table public.portal_product_prices is
  'Fixed sell price for one product on one portal. Wins over the portal rule. Company specials and corporate catalog lines still win.';

alter table public.portal_product_prices enable row level security;

revoke all on table public.portal_product_prices from public, anon;
grant select, insert, update, delete on table public.portal_product_prices to authenticated;
grant all on table public.portal_product_prices to service_role;

drop policy if exists portal_product_prices_read on public.portal_product_prices;
create policy portal_product_prices_read
  on public.portal_product_prices
  for select
  using (public.is_pricing_viewer());

drop policy if exists portal_product_prices_write on public.portal_product_prices;
create policy portal_product_prices_write
  on public.portal_product_prices
  for all
  using (public.is_pricing_editor())
  with check (public.is_pricing_editor());

create table if not exists public.price_change_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id),
  product_id uuid references public.products (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  portal text,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);

comment on table public.price_change_log is
  'Who changed a price or portal rule, from what to what, and when. Sales cannot read cost rows.';

create index if not exists price_change_log_created_idx
  on public.price_change_log (created_at desc);

alter table public.price_change_log enable row level security;

revoke all on table public.price_change_log from public, anon;
grant select, insert on table public.price_change_log to authenticated;
grant all on table public.price_change_log to service_role;

drop policy if exists price_change_log_read on public.price_change_log;
create policy price_change_log_read
  on public.price_change_log
  for select
  using (
    public.is_pricing_editor()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role = 'management'
    )
    or (
      field <> 'cost'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.role = 'sales'
      )
    )
  );

drop policy if exists price_change_log_insert on public.price_change_log;
create policy price_change_log_insert
  on public.price_change_log
  for insert
  with check (
    public.is_pricing_editor()
    or (
      field <> 'cost'
      and exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_active
          and p.role in ('sales', 'management')
      )
    )
  );

create or replace function public.pricing_round_money(p_amount numeric, p_mode text)
returns numeric
language sql
immutable
set search_path = public
as $$
  select case
    when p_amount is null then null
    when p_mode = 'whole' then round(p_amount, 0)
    when p_mode = 'end9' and p_amount <= 0 then 0
    when p_mode = 'end9' then
      case
        when round((p_amount - 9) / 10.0, 0) * 10 + 9 > 0
          then round((p_amount - 9) / 10.0, 0) * 10 + 9
        else 9
      end
    when p_mode = 'end99' and p_amount <= 0 then 0
    when p_mode = 'end99' then
      case
        when round((p_amount - 99) / 100.0, 0) * 100 + 99 > 0
          then round((p_amount - 99) / 100.0, 0) * 100 + 99
        else 99
      end
    else round(p_amount, 2)
  end;
$$;

revoke all on function public.pricing_round_money(numeric, text) from public, anon;
grant execute on function public.pricing_round_money(numeric, text) to authenticated, service_role;

create or replace function public.portal_unit_price(
  p_portal text,
  p_product_id uuid,
  p_company_id uuid,
  p_retail numeric,
  p_cost numeric,
  p_company_margin numeric,
  p_catalog_manual numeric,
  p_quote_override numeric default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_retail numeric;
  v_cost numeric;
  v_margin numeric;
  v_company_margin numeric;
  v_base_mode text;
  v_fallback text;
  v_rounding text;
  v_special numeric;
  v_fixed numeric;
  v_price numeric;
  v_use_cost boolean;
begin
  if p_portal not in ('store', 'business', 'corporate') then
    return null;
  end if;

  -- Returns a sell price only. Cost stays inside this function.
  -- Service role and pricing staff may price any company. A client may price only their company.
  if coalesce(auth.role(), '') is distinct from 'service_role'
     and not public.is_pricing_staff()
     and p_company_id is not null
     and p_company_id is distinct from public.client_company_id()
     and not exists (
       select 1
       from public.profiles p
       where p.id = auth.uid()
         and p.is_active
         and p.role = 'business_user'
         and p.company_id = p_company_id
     )
  then
    raise exception 'Not permitted';
  end if;

  v_retail := coalesce(p_retail, (select p.price from public.products p where p.id = p_product_id));
  v_cost := coalesce(p_cost, (select pc.supplier_cost from public.product_costs pc where pc.product_id = p_product_id));

  select
    case p_portal
      when 'store' then s.store_margin_percent
      when 'business' then s.business_margin_percent
      else s.corporate_margin_percent
    end,
    case p_portal
      when 'store' then s.store_price_base
      when 'business' then s.business_price_base
      else s.corporate_price_base
    end,
    case p_portal
      when 'store' then s.store_no_cost_fallback
      when 'business' then s.business_no_cost_fallback
      else s.corporate_no_cost_fallback
    end,
    case p_portal
      when 'store' then s.store_rounding
      when 'business' then s.business_rounding
      else s.corporate_rounding
    end
  into v_margin, v_base_mode, v_fallback, v_rounding
  from public.org_settings s
  limit 1;

  v_base_mode := coalesce(v_base_mode, 'retail');
  v_fallback := coalesce(v_fallback, 'retail_margin');
  v_rounding := coalesce(v_rounding, 'none');

  if p_quote_override is not null and p_quote_override >= 0 then
    return public.pricing_round_money(p_quote_override, v_rounding);
  end if;

  if p_portal <> 'store' and p_company_id is not null and p_product_id is not null then
    select cpp.price into v_special
    from public.company_product_prices cpp
    where cpp.company_id = p_company_id
      and cpp.product_id = p_product_id
      and cpp.price >= 0
      and (cpp.valid_until is null or cpp.valid_until >= current_date)
    limit 1;
    if v_special is not null then
      return public.pricing_round_money(v_special, v_rounding);
    end if;
  end if;

  if p_portal = 'corporate' and p_catalog_manual is not null and p_catalog_manual >= 0 then
    return public.pricing_round_money(p_catalog_manual, v_rounding);
  end if;

  if p_product_id is not null then
    select ppp.price into v_fixed
    from public.portal_product_prices ppp
    where ppp.product_id = p_product_id
      and ppp.portal = p_portal
      and ppp.price >= 0
      and (ppp.valid_until is null or ppp.valid_until >= current_date)
    limit 1;
    if v_fixed is not null then
      return public.pricing_round_money(v_fixed, v_rounding);
    end if;
  end if;

  v_use_cost := v_base_mode = 'cost';
  v_company_margin := case when p_portal = 'store' then null else p_company_margin end;

  if v_use_cost and v_cost is not null then
    if coalesce(v_company_margin, v_margin) is not null then
      v_price := v_cost * (1 + coalesce(v_company_margin, v_margin) / 100.0);
    else
      v_price := v_cost;
    end if;
  elsif v_use_cost and v_cost is null and v_fallback = 'on_quote' then
    return null;
  elsif p_portal = 'store' and not v_use_cost then
    v_price := greatest(coalesce(v_retail, 0), 0);
  elsif coalesce(v_company_margin, v_margin) is not null then
    v_price := coalesce(v_retail, 0) * (1 + coalesce(v_company_margin, v_margin) / 100.0);
  else
    v_price := greatest(coalesce(v_retail, 0), 0);
  end if;

  return public.pricing_round_money(v_price, v_rounding);
end;
$$;

comment on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) is
  'Sell price for store, business, or corporate. Matches src/lib/pricing/engine.ts. Does not return cost.';

revoke all on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) to authenticated, service_role;

create or replace function public.listed_unit_price(
  p_company_id uuid,
  p_product_id uuid,
  p_base_price numeric,
  p_company_margin numeric,
  p_catalog_manual numeric
)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select public.portal_unit_price(
    'corporate',
    p_product_id,
    p_company_id,
    p_base_price,
    null,
    p_company_margin,
    p_catalog_manual,
    null
  );
$$;

comment on function public.listed_unit_price(uuid, uuid, numeric, numeric, numeric) is
  'Corporate sell price. Delegates to portal_unit_price so portal, microsite, catalog, and direct orders share one engine.';

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

    if coalesce(v_product.sample_only, false) then
      raise exception '% is a sample. Request one piece instead of buying it', v_product.name;
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
      -- Pack rows keep the stored selling price. Other lines use listed_unit_price:
      -- company special, then the catalog manual price, then base price plus company margin.
      select count(*),
             min(case
               when cp.pack_option is not null then cp.selling_price
               else public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, cp.manual_price)
             end),
             max(case
               when cp.pack_option is not null then cp.selling_price
               else public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, cp.manual_price)
             end)
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

    if v_unit is null and p_surface in ('portal', 'microsite') and v_show then
      v_unit := public.listed_unit_price(p_company_id, v_product.id, v_product.price, v_company_margin, null);
    elsif v_unit is null and p_surface = 'store' and v_show then
      v_unit := public.portal_unit_price('store', v_product.id, null, v_product.price, null, null, null, null);
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

commit;
