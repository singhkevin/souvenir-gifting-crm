-- Multiple supplier offers per product, best eligible cost, and per-surface sell-price toggles.
-- Clients never receive supplier cost. Portal catalogue price stays a sell price or null (RFQ only).
-- best_supplier_cost is security definer so the portal view can use it. It is not granted to anon or authenticated.
--
-- Do not apply from the agent. Apply after 20261005_quotation_line_accept.sql.

begin;

create or replace function public.is_pricing_staff()
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
      and p.role in ('admin', 'sales', 'management', 'accounts')
  );
$$;

revoke all on function public.is_pricing_staff() from public;
grant execute on function public.is_pricing_staff() to authenticated;

create table if not exists public.product_supplier_offers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  supplier_sku text,
  cost numeric not null check (cost >= 0),
  moq integer not null default 1 check (moq >= 1),
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  in_stock boolean not null default true,
  is_active boolean not null default true,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, supplier_id)
);

create index if not exists product_supplier_offers_product_idx
  on public.product_supplier_offers (product_id);

create unique index if not exists product_supplier_offers_one_preferred
  on public.product_supplier_offers (product_id)
  where is_preferred;

comment on table public.product_supplier_offers is
  'Staff-only supplier offers for one product. Clients cannot select this table. Pin is_preferred to override the cheapest eligible offer.';

alter table public.product_supplier_offers enable row level security;

revoke all on public.product_supplier_offers from anon;
revoke all on public.product_supplier_offers from authenticated;
grant select, insert, update, delete on public.product_supplier_offers to authenticated;

drop policy if exists product_supplier_offers_staff on public.product_supplier_offers;
create policy product_supplier_offers_staff
  on public.product_supplier_offers
  for all
  using (public.is_pricing_staff())
  with check (public.is_pricing_staff());

create table if not exists public.quotation_item_costs (
  quotation_item_id uuid primary key references public.quotation_items (id) on delete cascade,
  supplier_offer_id uuid references public.product_supplier_offers (id) on delete set null,
  supplier_cost numeric check (supplier_cost is null or supplier_cost >= 0),
  margin_percent numeric check (margin_percent is null or margin_percent >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.quotation_item_costs is
  'Staff-only negotiated cost for a quotation line. Not readable by portal clients.';

alter table public.quotation_item_costs enable row level security;

revoke all on public.quotation_item_costs from anon;
revoke all on public.quotation_item_costs from authenticated;
grant select, insert, update, delete on public.quotation_item_costs to authenticated;

drop policy if exists quotation_item_costs_staff on public.quotation_item_costs;
create policy quotation_item_costs_staff
  on public.quotation_item_costs
  for all
  using (public.is_pricing_staff())
  with check (public.is_pricing_staff());

alter table public.org_settings
  add column if not exists best_cost_require_in_stock boolean not null default true,
  add column if not exists crm_use_best_cost boolean not null default false,
  add column if not exists crm_show_sell_price boolean not null default true,
  add column if not exists portal_use_best_cost boolean not null default false,
  add column if not exists portal_show_sell_price boolean not null default true,
  add column if not exists microsite_use_best_cost boolean not null default false,
  add column if not exists microsite_show_sell_price boolean not null default true,
  add column if not exists store_use_best_cost boolean not null default false,
  add column if not exists store_show_sell_price boolean not null default true;

comment on column public.org_settings.best_cost_require_in_stock is
  'When true, an out-of-stock offer is not eligible to be the best cost.';
comment on column public.org_settings.crm_use_best_cost is
  'When true, new CRM quotation lines can derive sell price from the best eligible supplier cost.';
comment on column public.org_settings.portal_show_sell_price is
  'When false, client_products.price is null so the portal shows RFQ instead of a sell price.';

create or replace function public.best_supplier_cost(
  p_product_id uuid,
  p_quantity integer default null
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with flags as (
    select coalesce(best_cost_require_in_stock, true) as require_stock
    from public.org_settings
    limit 1
  ),
  eligible as (
    select o.cost, o.is_preferred, o.lead_time_days, o.created_at
    from public.product_supplier_offers o
    cross join flags f
    where o.product_id = p_product_id
      and o.is_active
      and (not f.require_stock or o.in_stock)
      and (p_quantity is null or o.moq <= p_quantity)
  ),
  preferred as (
    select cost
    from eligible
    where is_preferred
    order by cost asc, lead_time_days asc nulls last, created_at asc
    limit 1
  )
  select coalesce(
    (select cost from preferred),
    (
      select cost
      from eligible
      order by cost asc, lead_time_days asc nulls last, created_at asc
      limit 1
    )
  );
$$;

comment on function public.best_supplier_cost(uuid, integer) is
  'Lowest active offer that meets stock and MOQ rules. A preferred offer wins when it is eligible. Not granted to clients; the portal view calls it as owner and returns only a sell price.';

revoke all on function public.best_supplier_cost(uuid, integer) from public;
revoke all on function public.best_supplier_cost(uuid, integer) from anon;
revoke all on function public.best_supplier_cost(uuid, integer) from authenticated;

drop view if exists public.client_products;

create view public.client_products as
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
        ), p.supplier_cost)
        else p.supplier_cost
      end,
      p.price,
      p.internal_margin,
      (select c.margin_percent from public.companies c where c.id = public.client_company_id()),
      'b2b'
    )
  end as price,
  p.moq,
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

comment on view public.client_products is
  'Client-safe catalogue. Price is the B2B sell price, or null when portal sell prices are hidden. No cost, supplier, or margin columns.';

revoke all on public.client_products from anon;
grant select on public.client_products to authenticated;

commit;
