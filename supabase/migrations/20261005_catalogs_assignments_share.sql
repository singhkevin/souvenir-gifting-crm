-- Catalogs (app name) are stored in the existing campaigns / campaign_products tables.
-- This migration does not rename those tables.
--
--   campaigns              = a catalog
--   campaigns.company_id   = primary company for sell-price defaults (nullable = unassigned)
--   campaigns.cloned_from  = source catalog when duplicated
--   campaign_products      = curated products on that catalog
--   catalog_assignments    = companies a catalog is shared with
--   catalog_share_links    = temporary public read tokens
--
-- Do not apply from the agent. Deliver for Hostinger/ops.

begin;

-- 1. Unassigned catalogs + duplicate audit
alter table public.campaigns
  add column if not exists cloned_from uuid references public.campaigns (id) on delete set null;

alter table public.campaigns
  alter column company_id drop not null;

comment on column public.campaigns.company_id is
  'Primary company for sell-price defaults and legacy joins. Null means the catalog is not assigned yet. Company access is catalog_assignments.';

comment on column public.campaigns.cloned_from is
  'Source campaigns.id when this catalog was duplicated. Null for catalogs created from scratch.';

create index if not exists campaigns_cloned_from_idx
  on public.campaigns (cloned_from);

-- 2. Staff helper (invoker: reads the caller''s own profile row)
create or replace function public.is_catalog_staff()
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
      and p.role in ('admin', 'sales', 'management')
  );
$$;

revoke all on function public.is_catalog_staff() from public;
grant execute on function public.is_catalog_staff() to authenticated;

-- Allow creating and clearing the primary company without replacing existing staff policies.
drop policy if exists campaigns_insert_unassigned on public.campaigns;
create policy campaigns_insert_unassigned
  on public.campaigns
  for insert
  with check (company_id is null and public.is_catalog_staff());

drop policy if exists campaigns_allow_unassigned_company on public.campaigns;
create policy campaigns_allow_unassigned_company
  on public.campaigns
  for update
  using (false)
  with check (company_id is null and public.is_catalog_staff());

-- 3. Assignments
create table if not exists public.catalog_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, company_id)
);

create index if not exists catalog_assignments_company_idx
  on public.catalog_assignments (company_id);

comment on table public.catalog_assignments is
  'Companies a catalog (campaigns row) is shared with. Portal lists are driven by this table plus legacy campaigns.company_id.';

insert into public.catalog_assignments (campaign_id, company_id)
select c.id, c.company_id
from public.campaigns c
where c.company_id is not null
on conflict (campaign_id, company_id) do nothing;

alter table public.catalog_assignments enable row level security;

revoke all on public.catalog_assignments from anon;
revoke all on public.catalog_assignments from authenticated;
grant select, insert, update, delete on public.catalog_assignments to authenticated;

drop policy if exists catalog_assignments_staff_all on public.catalog_assignments;
create policy catalog_assignments_staff_all
  on public.catalog_assignments
  for all
  using (public.is_catalog_staff())
  with check (public.is_catalog_staff());

drop policy if exists catalog_assignments_client_select on public.catalog_assignments;
create policy catalog_assignments_client_select
  on public.catalog_assignments
  for select
  using (
    public.is_client()
    and company_id = public.client_company_id()
  );

-- Clients can read catalogs assigned to their company even when campaigns.company_id points elsewhere.
drop policy if exists campaigns_assigned_client_select on public.campaigns;
create policy campaigns_assigned_client_select
  on public.campaigns
  for select
  using (
    public.is_client()
    and exists (
      select 1
      from public.catalog_assignments a
      where a.campaign_id = campaigns.id
        and a.company_id = public.client_company_id()
    )
  );

drop policy if exists campaign_products_assigned_client_select on public.campaign_products;
create policy campaign_products_assigned_client_select
  on public.campaign_products
  for select
  using (
    public.is_client()
    and visibility = 'published'
    and exists (
      select 1
      from public.catalog_assignments a
      where a.campaign_id = campaign_products.campaign_id
        and a.company_id = public.client_company_id()
    )
  );

-- Shortlist writes for an assigned catalog (does not widen access to other companies).
drop policy if exists client_selections_assigned_insert on public.client_product_selections;
create policy client_selections_assigned_insert
  on public.client_product_selections
  for insert
  with check (
    public.is_client()
    and user_id = auth.uid()
    and company_id = public.client_company_id()
    and exists (
      select 1
      from public.catalog_assignments a
      where a.campaign_id = client_product_selections.campaign_id
        and a.company_id = public.client_company_id()
    )
  );

drop policy if exists client_selections_assigned_update on public.client_product_selections;
create policy client_selections_assigned_update
  on public.client_product_selections
  for update
  using (
    public.is_client()
    and user_id = auth.uid()
    and company_id = public.client_company_id()
    and exists (
      select 1
      from public.catalog_assignments a
      where a.campaign_id = client_product_selections.campaign_id
        and a.company_id = public.client_company_id()
    )
  )
  with check (
    public.is_client()
    and user_id = auth.uid()
    and company_id = public.client_company_id()
    and exists (
      select 1
      from public.catalog_assignments a
      where a.campaign_id = client_product_selections.campaign_id
        and a.company_id = public.client_company_id()
    )
  );

-- 4. Share links. No anon table access; the definer function is the only public read path.
create table if not exists public.catalog_share_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint catalog_share_links_token_len check (char_length(token) between 16 and 128)
);

create index if not exists catalog_share_links_campaign_idx
  on public.catalog_share_links (campaign_id, created_at desc);

comment on table public.catalog_share_links is
  'Public read tokens for one catalog. Anon cannot select this table. get_shared_catalog(token) returns client-facing fields only.';

alter table public.catalog_share_links enable row level security;

revoke all on public.catalog_share_links from anon;
revoke all on public.catalog_share_links from authenticated;
grant select, insert, update, delete on public.catalog_share_links to authenticated;

drop policy if exists catalog_share_links_staff_all on public.catalog_share_links;
create policy catalog_share_links_staff_all
  on public.catalog_share_links
  for all
  using (public.is_catalog_staff())
  with check (public.is_catalog_staff());

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

revoke all on function public.get_shared_catalog(text) from public;
grant execute on function public.get_shared_catalog(text) to anon, authenticated;

commit;
