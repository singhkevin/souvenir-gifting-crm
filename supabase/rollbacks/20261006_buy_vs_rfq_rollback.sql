-- Rollback for 20261006_buy_vs_rfq.sql
-- Drops the direct-purchase function, restores client_products and get_shared_catalog
-- to the definitions from 20261005_supplier_offers.sql and 20261005_catalog_rfq.sql,
-- then drops products.stock_qty and products.fulfillment_mode.
-- Orders already created by place_direct_order are left in place.
-- Stock counts recorded in stock_qty are removed with the column.

begin;

revoke all on function public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb) from public, anon, authenticated, service_role;
drop function if exists public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb);

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

create or replace function public.get_shared_catalog(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_name text;
  v_occasion text;
  v_budget numeric;
  v_expires timestamptz;
  v_products jsonb;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 128 then
    return null;
  end if;

  select l.campaign_id, l.expires_at
    into v_campaign_id, v_expires
  from public.catalog_share_links l
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now());

  if v_campaign_id is null then
    return null;
  end if;

  select c.name, c.occasion, c.budget_per_employee
    into v_name, v_occasion, v_budget
  from public.campaigns c
  where c.id = v_campaign_id;

  if v_name is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', cp.id,
        'product_id', cp.product_id,
        'sku', p.sku,
        'display_name', cp.display_name,
        'client_description', cp.client_description,
        'client_image_url', cp.client_image_url,
        'selling_price', cp.selling_price,
        'moq', cp.moq,
        'pack_option', cp.pack_option,
        'pack_kit_id', cp.pack_kit_id,
        'pack_kit_role', cp.pack_kit_role,
        'pack_kit_total', cp.pack_kit_total,
        'display_order', cp.display_order
      )
      order by cp.display_order nulls last, cp.display_name
    ),
    '[]'::jsonb
  )
    into v_products
  from public.campaign_products cp
  join public.products p on p.id = cp.product_id
  where cp.campaign_id = v_campaign_id
    and cp.visibility = 'published'
    and p.status = 'active';

  return jsonb_build_object(
    'name', v_name,
    'occasion', v_occasion,
    'budget_per_employee', v_budget,
    'expires_at', v_expires,
    'products', v_products
  );
end;
$$;

comment on function public.get_shared_catalog(text) is
  'Public catalog read by share token. Returns name, occasion, budget, published client sell prices, product id, and sku. No supplier cost, margin, or other catalogs.';

alter table public.products
  drop constraint if exists products_stock_qty_check;

alter table public.products
  drop constraint if exists products_fulfillment_mode_check;

alter table public.products
  drop column if exists stock_qty,
  drop column if exists fulfillment_mode;

commit;
