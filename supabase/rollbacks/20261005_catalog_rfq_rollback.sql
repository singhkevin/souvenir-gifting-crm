-- Rollback for 20261005_catalog_rfq.sql
-- Restores the previous get_shared_catalog payload (no product_id / sku).
-- Does not drop requirement_products.quantity: that column may already have existed.

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
  'Public catalog read by share token. Returns name, occasion, budget, and published client sell prices only. No supplier cost, margin, or other catalogs.';

drop index if exists public.requirements_campaign_idx;

alter table public.requirements
  drop column if exists campaign_id;

commit;
