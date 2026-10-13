-- Shared catalog reads follow portal product visibility.
-- Do not apply from the agent. Apply after 20261014_categories_unique.sql.
--
-- get_shared_catalog is security definer, so it used to return every published
-- active product on the catalog and bypassed products RLS. This restores the
-- same rule the portal uses:
--   * signed-in client (is_client()): products visible to client_company_id()
--   * everyone else: products visible to catalog_share_links.company_id when the
--     link is tied to one company, otherwise active public catalogue products
-- Company visibility matches products_public_catalogue_select (active,
-- catalogue_access = 'all') OR products_client_granted_select (active,
-- catalogue_access = 'selected', granted, not excluded), and also subtracts
-- company_product_exclusions from public products the way client_products does.
-- A kit is omitted when any published member fails that check. The primary
-- pack_kit_total is the sum of the published member sell prices so it matches
-- the lines a quote expands.

begin;

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
  v_link_company uuid;
  v_company_id uuid;
  v_products jsonb;
begin
  if p_token is null or char_length(p_token) < 16 or char_length(p_token) > 128 then
    return null;
  end if;

  select l.campaign_id, l.expires_at, l.company_id
    into v_campaign_id, v_expires, v_link_company
  from public.catalog_share_links l
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now());

  if v_campaign_id is null then
    return null;
  end if;

  -- A signed-in client sees their own company, never the company stamped on the link.
  if public.is_client() then
    v_company_id := public.client_company_id();
  else
    v_company_id := v_link_company;
  end if;

  select c.name, c.occasion, c.budget_per_employee
    into v_name, v_occasion, v_budget
  from public.campaigns c
  where c.id = v_campaign_id;

  if v_name is null then
    return null;
  end if;

  with visible_products as (
    select p.id
    from public.products p
    where p.status = 'active'
      and (
        case
          when v_company_id is null then p.catalogue_access = 'all'
          else
            not exists (
              select 1
              from public.company_product_exclusions e
              where e.product_id = p.id
                and e.company_id = v_company_id
            )
            and (
              p.catalogue_access = 'all'
              or (
                p.catalogue_access = 'selected'
                and exists (
                  select 1
                  from public.company_product_access a
                  where a.product_id = p.id
                    and a.company_id = v_company_id
                )
              )
            )
        end
      )
  )
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
        'pack_kit_total', case
          when cp.pack_kit_id is null or cp.pack_kit_role = 'line' then cp.pack_kit_total
          else (
            select round(sum(member.selling_price), 2)
            from public.campaign_products member
            where member.campaign_id = cp.campaign_id
              and member.pack_kit_id = cp.pack_kit_id
              and member.visibility = 'published'
          )
        end,
        'display_order', cp.display_order,
        'stock_qty', p.stock_qty,
        'fulfillment_mode', p.fulfillment_mode
      )
      order by cp.display_order nulls last, cp.display_name
    ),
    '[]'::jsonb
  )
    into v_products
  from public.campaign_products cp
  join public.products p on p.id = cp.product_id
  join visible_products vp on vp.id = p.id
  where cp.campaign_id = v_campaign_id
    and cp.visibility = 'published'
    and (
      cp.pack_kit_id is null
      or not exists (
        select 1
        from public.campaign_products other
        where other.campaign_id = cp.campaign_id
          and other.pack_kit_id = cp.pack_kit_id
          and other.visibility = 'published'
          and not exists (
            select 1
            from visible_products other_visible
            where other_visible.id = other.product_id
          )
      )
    );

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
  'Public catalog read by share token. Signed-in clients see products visible to their company. Guests see active public products, or products visible to the link company when catalog_share_links.company_id is set. Kits with a hidden member are omitted. No supplier cost or margin.';

revoke all on function public.get_shared_catalog(text) from public;
grant execute on function public.get_shared_catalog(text) to anon, authenticated;

commit;
