-- Editable retail homepage and collections.
-- Apply after 54 (20261022_channel_visibility.sql). Do not apply from the agent.
--
-- New tables only. Nothing existing is altered, so the store keeps rendering exactly as
-- coded until 20261022_homepage_cms_seed.sql adds rows; the app falls back to its built-in
-- content (src/lib/homepage/defaults.ts) while these tables are missing or empty.
--
--   collections           editorial collections: a rule over existing product fields, or a
--                         manual product list; draft/published status, store/business
--                         switches, listed on /collections, optional date window
--   collection_products   manual products in order (rule collections: pinned first)
--   homepage_sections     one row per homepage section; content in draft and published jsonb
--   homepage_slots        dated overrides for a section (window, yearly repeat, priority)
--
-- Access: RLS on, admin-only policies for every operation. No anon or client policy: the
-- storefront reads these with the service-role key on the server.

begin;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title text not null check (length(btrim(title)) between 1 and 120),
  kicker text not null default '',
  description text not null default '',
  image_url text,
  source text not null default 'rule' check (source in ('rule', 'manual')),
  rule jsonb not null default '{}'::jsonb check (jsonb_typeof(rule) = 'object'),
  sort text not null default 'catalogue' check (sort in ('catalogue', 'price_asc', 'price_desc', 'newest')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  show_in_store boolean not null default true,
  show_in_business boolean not null default true,
  listed boolean not null default true,
  starts_on date,
  ends_on date,
  repeat_yearly boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, product_id)
);
create index if not exists collection_products_product_idx on public.collection_products (product_id);

create table if not exists public.homepage_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null default 'retail_home' check (page in ('retail_home')),
  section_key text not null check (section_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(section_key) <= 60),
  section_type text not null check (section_type in ('hero', 'occasion_grid', 'product_rail', 'brand_row', 'packaging', 'catalogue_grid')),
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  published jsonb check (published is null or jsonb_typeof(published) = 'object'),
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (page, section_key)
);

-- draft null with published set = removed in the draft, still live until the next publish.
create table if not exists public.homepage_slots (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.homepage_sections(id) on delete cascade,
  draft jsonb check (draft is null or jsonb_typeof(draft) = 'object'),
  published jsonb check (published is null or jsonb_typeof(published) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (draft is not null or published is not null)
);
create index if not exists homepage_slots_section_idx on public.homepage_slots (section_id);

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();
drop trigger if exists homepage_sections_updated_at on public.homepage_sections;
create trigger homepage_sections_updated_at before update on public.homepage_sections
  for each row execute function public.set_updated_at();
drop trigger if exists homepage_slots_updated_at on public.homepage_slots;
create trigger homepage_slots_updated_at before update on public.homepage_slots
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.homepage_sections enable row level security;
alter table public.homepage_slots enable row level security;

revoke all on public.collections, public.collection_products, public.homepage_sections, public.homepage_slots from anon;
grant select, insert, update, delete on public.collections, public.collection_products, public.homepage_sections, public.homepage_slots to authenticated;

drop policy if exists collections_admin_all on public.collections;
create policy collections_admin_all on public.collections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists collection_products_admin_all on public.collection_products;
create policy collection_products_admin_all on public.collection_products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists homepage_sections_admin_all on public.homepage_sections;
create policy homepage_sections_admin_all on public.homepage_sections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists homepage_slots_admin_all on public.homepage_slots;
create policy homepage_slots_admin_all on public.homepage_slots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Publish the homepage draft in one transaction: sections copy draft to published, slots
-- removed in the draft are deleted, the rest copy draft to published. Admin only.
create or replace function public.publish_homepage(p_page text default 'retail_home')
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish the homepage' using errcode = '42501';
  end if;
  delete from public.homepage_slots s
  using public.homepage_sections h
  where s.section_id = h.id and h.page = p_page and s.draft is null;
  update public.homepage_slots s
  set published = s.draft, updated_by = auth.uid()
  from public.homepage_sections h
  where s.section_id = h.id and h.page = p_page and s.published is distinct from s.draft;
  update public.homepage_sections
  set published = draft, published_at = now(), published_by = auth.uid()
  where page = p_page;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.publish_homepage(text) from public, anon;
grant execute on function public.publish_homepage(text) to authenticated;

commit;
