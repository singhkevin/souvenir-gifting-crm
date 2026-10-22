-- Dry run for 20261022_homepage_cms.sql + seed + rollback. Safe on production: everything runs
-- inside one DO block that always ends with an exception, so every change is rolled back.
-- Expected result: an error "DRYRUN_RESULT {...}" with ok=true. Any other error is a failure.
-- GENERATED from the migration, seed and rollback files; regenerate after editing them.
--
-- Checks: tables, RLS (anon blocked, non-admin sees nothing and cannot write or publish, admin
-- can), seed counts and idempotency, publish flow (draft to published, removed slots deleted),
-- and that the rollback removes everything. Returns the seeded rows so the app's parser can be
-- compared with the built-in homepage (scripts/homepage-dry-run-compare.ts).
-- Run with the Supabase SQL editor or execute_sql; the result is in the error message.

do $dry$
declare
  r jsonb := '{}'::jsonb;
  v_admin uuid;
  v_count integer;
  v_ok boolean;
  v_section uuid;
  v_slot uuid;
  v_rows jsonb;
begin
  set local lock_timeout = '3s';
  if to_regclass('public.collections') is not null or to_regclass('public.homepage_sections') is not null then
    raise exception 'PRECONDITION: homepage tables already exist';
  end if;

  execute $mig$
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


$mig$;

  execute $seed$
-- GENERATED from src/lib/homepage/defaults.ts by scripts/generate-homepage-seed.ts. Do not edit by hand.
-- Seed for 20261022_homepage_cms.sql: the coded homepage and collections, so the store looks
-- the same on day one. Inserts only missing rows (on conflict do nothing), so re-running never
-- overwrites CRM edits. Apply after 20261022_homepage_cms.sql. Do not apply from the agent.


insert into public.collections
  (slug, title, kicker, description, image_url, source, rule, sort, status, show_in_store, show_in_business, listed, starts_on, ends_on, repeat_yearly, position)
values
  ('executive-edit', 'The Executive Edit', 'Collection', 'Premium gifts for leadership and VIP clients.', null, 'rule', $json${"any":[{"field":"category","in":["Apparel","Bags & Travel","Awards & Recognition","Watches"]},{"field":"price","gte":2500}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 10),
  ('new-joiner-essentials', 'New Joiner Essentials', 'Collection', 'Thoughtful employee onboarding from the live catalogue.', null, 'rule', $json${"any":[{"field":"category","in":["Welcome Kits"]},{"field":"name","keywords":["welcome","onboard","lanyard","kit"]},{"field":"description","keywords":["welcome","onboard"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 20),
  ('client-appreciation', 'Client Appreciation', 'Collection', 'Gifts that strengthen business relationships.', null, 'rule', $json${"any":[{"field":"category","in":["Hampers & Gift Sets","Awards & Recognition","Home & Lifestyle"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 30),
  ('festival-gifting', 'Festive Corporate', 'Collection', 'Premium seasonal gifting for celebrations and festivals.', null, 'rule', $json${"any":[{"field":"category","in":["Hampers & Gift Sets"]},{"field":"name","keywords":["festive","hamper","celebration"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 40),
  ('conference-and-events', 'Conference & Events', 'Collection', 'Drinkware, desk pieces and tech for events and offsites.', null, 'rule', $json${"any":[{"field":"category","in":["Drinkware","Desk & Stationery","Tech & Electronics"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 50),
  ('welcome-kits', 'Welcome Kits', 'Collection', 'The Welcome Kits category, presented as a programme.', null, 'rule', $json${"any":[{"field":"category","in":["Welcome Kits"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 60),
  ('sustainable-gifting', 'The Sustainable Edit', 'Collection', 'Thoughtful eco-conscious gifting from the catalogue.', null, 'rule', $json${"any":[{"field":"category","in":["Eco-Friendly Gifts"]},{"field":"name","keywords":["recycled","bamboo","eco","sustainable"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 70),
  ('premium-corporate-gifts', 'Premium Corporate Gifts', 'Collection', 'Higher-value catalogue pieces, selected from existing prices.', null, 'rule', $json${"any":[{"field":"price","gte":2000}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 80),
  ('desk-essentials', 'Desk Essentials', 'Collection', 'Stationery and desk accessories for everyday branded presence.', null, 'rule', $json${"any":[{"field":"category","in":["Desk & Stationery"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 90),
  ('premium-tech', 'Premium Tech', 'Collection', 'Smart products for modern teams.', null, 'rule', $json${"any":[{"field":"category","in":["Tech & Electronics"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 100),
  ('festive-band-current', 'Festive band (current)', 'Seasonal', 'Festive-tagged products, the Hampers & Gift Sets category, and festive, Diwali or hamper names.', null, 'rule', $json${"any":[{"field":"occasion","in":["festive"]},{"field":"category","in":["Hampers & Gift Sets"]},{"field":"name","keywords":["festive","diwali","hamper"]}]}$json$::jsonb, 'catalogue', 'published', true, true, false, null, null, false, 110),
  ('under-999', 'Under ₹999', 'Everyday', 'Priced products under ₹999, lowest price first.', null, 'rule', $json${"all":[{"field":"price","gt":0,"lt":999}]}$json$::jsonb, 'price_asc', 'published', true, true, false, null, null, false, 120)
on conflict (slug) do nothing;

insert into public.homepage_sections (page, section_key, section_type, draft, published, published_at)
values
  ('retail_home', 'hero', 'hero',
   $json${"type":"hero","visible":true,"position":10,"eyebrow":"The Souvenir Collection","heading":"Thoughtful gifting, *handcrafted* to be cherished.","subtext":"Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.","ctaLabel":"Explore Catalogue","ctaHref":"/catalogue","cta2Label":"Request a Quote","cta2Href":"/request-quote","source":{"kind":"auto"},"itemCount":12,"stats":[{"title":"[X]-hour dispatch","text":"[Dispatch locations]"},{"title":"Gift packaging","text":"[Gift packaging on all orders]"},{"title":"Payment","text":"[Payment methods]"},{"title":"Direct gifting","text":"[Direct-to-recipient dispatch details]"}]}$json$::jsonb,
   $json${"type":"hero","visible":true,"position":10,"eyebrow":"The Souvenir Collection","heading":"Thoughtful gifting, *handcrafted* to be cherished.","subtext":"Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.","ctaLabel":"Explore Catalogue","ctaHref":"/catalogue","cta2Label":"Request a Quote","cta2Href":"/request-quote","source":{"kind":"auto"},"itemCount":12,"stats":[{"title":"[X]-hour dispatch","text":"[Dispatch locations]"},{"title":"Gift packaging","text":"[Gift packaging on all orders]"},{"title":"Payment","text":"[Payment methods]"},{"title":"Direct gifting","text":"[Direct-to-recipient dispatch details]"}]}$json$::jsonb,
   now()),
  ('retail_home', 'occasions', 'occasion_grid',
   $json${"type":"occasion_grid","visible":true,"position":20,"eyebrow":"Collections","heading":"Gifts by occasion","ctaLabel":"View All Collections","ctaHref":"/collections","cards":[{"title":"Festive & Diwali Hampers","kicker":"Seasonal","line":"Hampers and festive boxes from the catalogue","href":"/collections/festival-gifting","collectionSlug":"festival-gifting","size":"large"},{"title":"Day-One Welcome Kits","kicker":"HR & People","line":"Onboarding sets ready to brand","href":"/collections/welcome-kits","collectionSlug":"welcome-kits","size":"large"},{"title":"Client & CXO Appreciation","kicker":"Executive","line":"Gifts for the relationships you keep","href":"/collections/client-appreciation","collectionSlug":"client-appreciation","size":"large"},{"title":"Onboarding Essentials","kicker":"First day","line":"Kits and desk pieces for new joiners","href":"/collections/new-joiner-essentials","collectionSlug":"new-joiner-essentials","size":"small"},{"title":"Conferences & Summits","kicker":"Events","line":"Drinkware, desk and tech for the room","href":"/collections/conference-and-events","collectionSlug":"conference-and-events","size":"small"},{"title":"Work Anniversary","kicker":"Milestones","line":"Recognition pieces for tenure and loyalty","href":"/collections/executive-edit","collectionSlug":"executive-edit","size":"small"}]}$json$::jsonb,
   $json${"type":"occasion_grid","visible":true,"position":20,"eyebrow":"Collections","heading":"Gifts by occasion","ctaLabel":"View All Collections","ctaHref":"/collections","cards":[{"title":"Festive & Diwali Hampers","kicker":"Seasonal","line":"Hampers and festive boxes from the catalogue","href":"/collections/festival-gifting","collectionSlug":"festival-gifting","size":"large"},{"title":"Day-One Welcome Kits","kicker":"HR & People","line":"Onboarding sets ready to brand","href":"/collections/welcome-kits","collectionSlug":"welcome-kits","size":"large"},{"title":"Client & CXO Appreciation","kicker":"Executive","line":"Gifts for the relationships you keep","href":"/collections/client-appreciation","collectionSlug":"client-appreciation","size":"large"},{"title":"Onboarding Essentials","kicker":"First day","line":"Kits and desk pieces for new joiners","href":"/collections/new-joiner-essentials","collectionSlug":"new-joiner-essentials","size":"small"},{"title":"Conferences & Summits","kicker":"Events","line":"Drinkware, desk and tech for the room","href":"/collections/conference-and-events","collectionSlug":"conference-and-events","size":"small"},{"title":"Work Anniversary","kicker":"Milestones","line":"Recognition pieces for tenure and loyalty","href":"/collections/executive-edit","collectionSlug":"executive-edit","size":"small"}]}$json$::jsonb,
   now()),
  ('retail_home', 'bestsellers', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":30,"eyebrow":"Most Requested","heading":"Retail Bestsellers — Ready to Ship","ctaLabel":"View All","ctaHref":"/catalogue?sort=newest","source":{"kind":"auto"},"itemCount":5,"columns":5,"dark":false}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":30,"eyebrow":"Most Requested","heading":"Retail Bestsellers — Ready to Ship","ctaLabel":"View All","ctaHref":"/catalogue?sort=newest","source":{"kind":"auto"},"itemCount":5,"columns":5,"dark":false}$json$::jsonb,
   now()),
  ('retail_home', 'brands', 'brand_row',
   $json${"type":"brand_row","visible":true,"position":40,"eyebrow":"Brands we work with","heading":"Brand partners","subtext":"Branded products available through our catalogue.","ctaLabel":"View All Brands","ctaHref":"/catalogue"}$json$::jsonb,
   $json${"type":"brand_row","visible":true,"position":40,"eyebrow":"Brands we work with","heading":"Brand partners","subtext":"Branded products available through our catalogue.","ctaLabel":"View All Brands","ctaHref":"/catalogue"}$json$::jsonb,
   now()),
  ('retail_home', 'under-999', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":50,"eyebrow":"Everyday","heading":"Merchandise under ₹999","ctaLabel":"View All","ctaHref":"/catalogue?priceMax=998","source":{"kind":"collection","collectionSlug":"under-999"},"itemCount":6,"columns":6,"dark":false}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":50,"eyebrow":"Everyday","heading":"Merchandise under ₹999","ctaLabel":"View All","ctaHref":"/catalogue?priceMax=998","source":{"kind":"collection","collectionSlug":"under-999"},"itemCount":6,"columns":6,"dark":false}$json$::jsonb,
   now()),
  ('retail_home', 'festive', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":60,"eyebrow":"Seasonal Editions","heading":"Festive Gift Hampers","ctaLabel":"View All","ctaHref":"/collections/festival-gifting","source":{"kind":"collection","collectionSlug":"festive-band-current"},"itemCount":4,"columns":4,"dark":true}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":60,"eyebrow":"Seasonal Editions","heading":"Festive Gift Hampers","ctaLabel":"View All","ctaHref":"/collections/festival-gifting","source":{"kind":"collection","collectionSlug":"festive-band-current"},"itemCount":4,"columns":4,"dark":true}$json$::jsonb,
   now()),
  ('retail_home', 'packaging', 'packaging',
   $json${"type":"packaging","visible":true,"position":70,"eyebrow":"Packaging & delivery","heading":"Every Gift, an Unforgettable *Unboxing Experience*.","imageUrls":[],"tiles":[{"title":"Gift wrapping & branded packaging","description":"Wrap each gift and add your branding to the box.","icon":"gift"},{"title":"Personal notes & greeting cards","description":"Add a printed note or greeting card to each gift.","icon":"pen"},{"title":"Direct-to-recipient shipping","description":"Ship each gift straight to the person receiving it.","icon":"truck"},{"title":"Bulk & multi-location dispatch","description":"Send one order to many addresses at once.","icon":"map"},{"title":"Recipient tracking","description":"Share tracking details with each recipient.","icon":"search"}]}$json$::jsonb,
   $json${"type":"packaging","visible":true,"position":70,"eyebrow":"Packaging & delivery","heading":"Every Gift, an Unforgettable *Unboxing Experience*.","imageUrls":[],"tiles":[{"title":"Gift wrapping & branded packaging","description":"Wrap each gift and add your branding to the box.","icon":"gift"},{"title":"Personal notes & greeting cards","description":"Add a printed note or greeting card to each gift.","icon":"pen"},{"title":"Direct-to-recipient shipping","description":"Ship each gift straight to the person receiving it.","icon":"truck"},{"title":"Bulk & multi-location dispatch","description":"Send one order to many addresses at once.","icon":"map"},{"title":"Recipient tracking","description":"Share tracking details with each recipient.","icon":"search"}]}$json$::jsonb,
   now()),
  ('retail_home', 'catalogue', 'catalogue_grid',
   $json${"type":"catalogue_grid","visible":true,"position":80,"heading":"Gift catalogue","subtext":"Filter the live catalogue by category, brand, price and occasion.","itemCount":8}$json$::jsonb,
   $json${"type":"catalogue_grid","visible":true,"position":80,"heading":"Gift catalogue","subtext":"Filter the live catalogue by category, brand, price and occasion.","itemCount":8}$json$::jsonb,
   now())
on conflict (page, section_key) do nothing;


$seed$;

  r := r || jsonb_build_object(
    'collections', (select count(*) from public.collections),
    'collections_published', (select count(*) from public.collections where status = 'published'),
    'collections_listed', (select count(*) from public.collections where listed),
    'sections', (select count(*) from public.homepage_sections),
    'sections_published_equals_draft', (select count(*) from public.homepage_sections where published = draft and published_at is not null),
    'slots', (select count(*) from public.homepage_slots),
    'rls_enabled', (select count(*) from pg_class where oid in ('public.collections'::regclass, 'public.collection_products'::regclass, 'public.homepage_sections'::regclass, 'public.homepage_slots'::regclass) and relrowsecurity),
    'policies', (select count(*) from pg_policies where schemaname = 'public' and tablename in ('collections', 'collection_products', 'homepage_sections', 'homepage_slots'))
  );

  -- Seed is idempotent.
  execute $seed$
-- GENERATED from src/lib/homepage/defaults.ts by scripts/generate-homepage-seed.ts. Do not edit by hand.
-- Seed for 20261022_homepage_cms.sql: the coded homepage and collections, so the store looks
-- the same on day one. Inserts only missing rows (on conflict do nothing), so re-running never
-- overwrites CRM edits. Apply after 20261022_homepage_cms.sql. Do not apply from the agent.


insert into public.collections
  (slug, title, kicker, description, image_url, source, rule, sort, status, show_in_store, show_in_business, listed, starts_on, ends_on, repeat_yearly, position)
values
  ('executive-edit', 'The Executive Edit', 'Collection', 'Premium gifts for leadership and VIP clients.', null, 'rule', $json${"any":[{"field":"category","in":["Apparel","Bags & Travel","Awards & Recognition","Watches"]},{"field":"price","gte":2500}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 10),
  ('new-joiner-essentials', 'New Joiner Essentials', 'Collection', 'Thoughtful employee onboarding from the live catalogue.', null, 'rule', $json${"any":[{"field":"category","in":["Welcome Kits"]},{"field":"name","keywords":["welcome","onboard","lanyard","kit"]},{"field":"description","keywords":["welcome","onboard"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 20),
  ('client-appreciation', 'Client Appreciation', 'Collection', 'Gifts that strengthen business relationships.', null, 'rule', $json${"any":[{"field":"category","in":["Hampers & Gift Sets","Awards & Recognition","Home & Lifestyle"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 30),
  ('festival-gifting', 'Festive Corporate', 'Collection', 'Premium seasonal gifting for celebrations and festivals.', null, 'rule', $json${"any":[{"field":"category","in":["Hampers & Gift Sets"]},{"field":"name","keywords":["festive","hamper","celebration"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 40),
  ('conference-and-events', 'Conference & Events', 'Collection', 'Drinkware, desk pieces and tech for events and offsites.', null, 'rule', $json${"any":[{"field":"category","in":["Drinkware","Desk & Stationery","Tech & Electronics"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 50),
  ('welcome-kits', 'Welcome Kits', 'Collection', 'The Welcome Kits category, presented as a programme.', null, 'rule', $json${"any":[{"field":"category","in":["Welcome Kits"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 60),
  ('sustainable-gifting', 'The Sustainable Edit', 'Collection', 'Thoughtful eco-conscious gifting from the catalogue.', null, 'rule', $json${"any":[{"field":"category","in":["Eco-Friendly Gifts"]},{"field":"name","keywords":["recycled","bamboo","eco","sustainable"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 70),
  ('premium-corporate-gifts', 'Premium Corporate Gifts', 'Collection', 'Higher-value catalogue pieces, selected from existing prices.', null, 'rule', $json${"any":[{"field":"price","gte":2000}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 80),
  ('desk-essentials', 'Desk Essentials', 'Collection', 'Stationery and desk accessories for everyday branded presence.', null, 'rule', $json${"any":[{"field":"category","in":["Desk & Stationery"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 90),
  ('premium-tech', 'Premium Tech', 'Collection', 'Smart products for modern teams.', null, 'rule', $json${"any":[{"field":"category","in":["Tech & Electronics"]}]}$json$::jsonb, 'catalogue', 'published', true, true, true, null, null, false, 100),
  ('festive-band-current', 'Festive band (current)', 'Seasonal', 'Festive-tagged products, the Hampers & Gift Sets category, and festive, Diwali or hamper names.', null, 'rule', $json${"any":[{"field":"occasion","in":["festive"]},{"field":"category","in":["Hampers & Gift Sets"]},{"field":"name","keywords":["festive","diwali","hamper"]}]}$json$::jsonb, 'catalogue', 'published', true, true, false, null, null, false, 110),
  ('under-999', 'Under ₹999', 'Everyday', 'Priced products under ₹999, lowest price first.', null, 'rule', $json${"all":[{"field":"price","gt":0,"lt":999}]}$json$::jsonb, 'price_asc', 'published', true, true, false, null, null, false, 120)
on conflict (slug) do nothing;

insert into public.homepage_sections (page, section_key, section_type, draft, published, published_at)
values
  ('retail_home', 'hero', 'hero',
   $json${"type":"hero","visible":true,"position":10,"eyebrow":"The Souvenir Collection","heading":"Thoughtful gifting, *handcrafted* to be cherished.","subtext":"Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.","ctaLabel":"Explore Catalogue","ctaHref":"/catalogue","cta2Label":"Request a Quote","cta2Href":"/request-quote","source":{"kind":"auto"},"itemCount":12,"stats":[{"title":"[X]-hour dispatch","text":"[Dispatch locations]"},{"title":"Gift packaging","text":"[Gift packaging on all orders]"},{"title":"Payment","text":"[Payment methods]"},{"title":"Direct gifting","text":"[Direct-to-recipient dispatch details]"}]}$json$::jsonb,
   $json${"type":"hero","visible":true,"position":10,"eyebrow":"The Souvenir Collection","heading":"Thoughtful gifting, *handcrafted* to be cherished.","subtext":"Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.","ctaLabel":"Explore Catalogue","ctaHref":"/catalogue","cta2Label":"Request a Quote","cta2Href":"/request-quote","source":{"kind":"auto"},"itemCount":12,"stats":[{"title":"[X]-hour dispatch","text":"[Dispatch locations]"},{"title":"Gift packaging","text":"[Gift packaging on all orders]"},{"title":"Payment","text":"[Payment methods]"},{"title":"Direct gifting","text":"[Direct-to-recipient dispatch details]"}]}$json$::jsonb,
   now()),
  ('retail_home', 'occasions', 'occasion_grid',
   $json${"type":"occasion_grid","visible":true,"position":20,"eyebrow":"Collections","heading":"Gifts by occasion","ctaLabel":"View All Collections","ctaHref":"/collections","cards":[{"title":"Festive & Diwali Hampers","kicker":"Seasonal","line":"Hampers and festive boxes from the catalogue","href":"/collections/festival-gifting","collectionSlug":"festival-gifting","size":"large"},{"title":"Day-One Welcome Kits","kicker":"HR & People","line":"Onboarding sets ready to brand","href":"/collections/welcome-kits","collectionSlug":"welcome-kits","size":"large"},{"title":"Client & CXO Appreciation","kicker":"Executive","line":"Gifts for the relationships you keep","href":"/collections/client-appreciation","collectionSlug":"client-appreciation","size":"large"},{"title":"Onboarding Essentials","kicker":"First day","line":"Kits and desk pieces for new joiners","href":"/collections/new-joiner-essentials","collectionSlug":"new-joiner-essentials","size":"small"},{"title":"Conferences & Summits","kicker":"Events","line":"Drinkware, desk and tech for the room","href":"/collections/conference-and-events","collectionSlug":"conference-and-events","size":"small"},{"title":"Work Anniversary","kicker":"Milestones","line":"Recognition pieces for tenure and loyalty","href":"/collections/executive-edit","collectionSlug":"executive-edit","size":"small"}]}$json$::jsonb,
   $json${"type":"occasion_grid","visible":true,"position":20,"eyebrow":"Collections","heading":"Gifts by occasion","ctaLabel":"View All Collections","ctaHref":"/collections","cards":[{"title":"Festive & Diwali Hampers","kicker":"Seasonal","line":"Hampers and festive boxes from the catalogue","href":"/collections/festival-gifting","collectionSlug":"festival-gifting","size":"large"},{"title":"Day-One Welcome Kits","kicker":"HR & People","line":"Onboarding sets ready to brand","href":"/collections/welcome-kits","collectionSlug":"welcome-kits","size":"large"},{"title":"Client & CXO Appreciation","kicker":"Executive","line":"Gifts for the relationships you keep","href":"/collections/client-appreciation","collectionSlug":"client-appreciation","size":"large"},{"title":"Onboarding Essentials","kicker":"First day","line":"Kits and desk pieces for new joiners","href":"/collections/new-joiner-essentials","collectionSlug":"new-joiner-essentials","size":"small"},{"title":"Conferences & Summits","kicker":"Events","line":"Drinkware, desk and tech for the room","href":"/collections/conference-and-events","collectionSlug":"conference-and-events","size":"small"},{"title":"Work Anniversary","kicker":"Milestones","line":"Recognition pieces for tenure and loyalty","href":"/collections/executive-edit","collectionSlug":"executive-edit","size":"small"}]}$json$::jsonb,
   now()),
  ('retail_home', 'bestsellers', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":30,"eyebrow":"Most Requested","heading":"Retail Bestsellers — Ready to Ship","ctaLabel":"View All","ctaHref":"/catalogue?sort=newest","source":{"kind":"auto"},"itemCount":5,"columns":5,"dark":false}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":30,"eyebrow":"Most Requested","heading":"Retail Bestsellers — Ready to Ship","ctaLabel":"View All","ctaHref":"/catalogue?sort=newest","source":{"kind":"auto"},"itemCount":5,"columns":5,"dark":false}$json$::jsonb,
   now()),
  ('retail_home', 'brands', 'brand_row',
   $json${"type":"brand_row","visible":true,"position":40,"eyebrow":"Brands we work with","heading":"Brand partners","subtext":"Branded products available through our catalogue.","ctaLabel":"View All Brands","ctaHref":"/catalogue"}$json$::jsonb,
   $json${"type":"brand_row","visible":true,"position":40,"eyebrow":"Brands we work with","heading":"Brand partners","subtext":"Branded products available through our catalogue.","ctaLabel":"View All Brands","ctaHref":"/catalogue"}$json$::jsonb,
   now()),
  ('retail_home', 'under-999', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":50,"eyebrow":"Everyday","heading":"Merchandise under ₹999","ctaLabel":"View All","ctaHref":"/catalogue?priceMax=998","source":{"kind":"collection","collectionSlug":"under-999"},"itemCount":6,"columns":6,"dark":false}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":50,"eyebrow":"Everyday","heading":"Merchandise under ₹999","ctaLabel":"View All","ctaHref":"/catalogue?priceMax=998","source":{"kind":"collection","collectionSlug":"under-999"},"itemCount":6,"columns":6,"dark":false}$json$::jsonb,
   now()),
  ('retail_home', 'festive', 'product_rail',
   $json${"type":"product_rail","visible":true,"position":60,"eyebrow":"Seasonal Editions","heading":"Festive Gift Hampers","ctaLabel":"View All","ctaHref":"/collections/festival-gifting","source":{"kind":"collection","collectionSlug":"festive-band-current"},"itemCount":4,"columns":4,"dark":true}$json$::jsonb,
   $json${"type":"product_rail","visible":true,"position":60,"eyebrow":"Seasonal Editions","heading":"Festive Gift Hampers","ctaLabel":"View All","ctaHref":"/collections/festival-gifting","source":{"kind":"collection","collectionSlug":"festive-band-current"},"itemCount":4,"columns":4,"dark":true}$json$::jsonb,
   now()),
  ('retail_home', 'packaging', 'packaging',
   $json${"type":"packaging","visible":true,"position":70,"eyebrow":"Packaging & delivery","heading":"Every Gift, an Unforgettable *Unboxing Experience*.","imageUrls":[],"tiles":[{"title":"Gift wrapping & branded packaging","description":"Wrap each gift and add your branding to the box.","icon":"gift"},{"title":"Personal notes & greeting cards","description":"Add a printed note or greeting card to each gift.","icon":"pen"},{"title":"Direct-to-recipient shipping","description":"Ship each gift straight to the person receiving it.","icon":"truck"},{"title":"Bulk & multi-location dispatch","description":"Send one order to many addresses at once.","icon":"map"},{"title":"Recipient tracking","description":"Share tracking details with each recipient.","icon":"search"}]}$json$::jsonb,
   $json${"type":"packaging","visible":true,"position":70,"eyebrow":"Packaging & delivery","heading":"Every Gift, an Unforgettable *Unboxing Experience*.","imageUrls":[],"tiles":[{"title":"Gift wrapping & branded packaging","description":"Wrap each gift and add your branding to the box.","icon":"gift"},{"title":"Personal notes & greeting cards","description":"Add a printed note or greeting card to each gift.","icon":"pen"},{"title":"Direct-to-recipient shipping","description":"Ship each gift straight to the person receiving it.","icon":"truck"},{"title":"Bulk & multi-location dispatch","description":"Send one order to many addresses at once.","icon":"map"},{"title":"Recipient tracking","description":"Share tracking details with each recipient.","icon":"search"}]}$json$::jsonb,
   now()),
  ('retail_home', 'catalogue', 'catalogue_grid',
   $json${"type":"catalogue_grid","visible":true,"position":80,"heading":"Gift catalogue","subtext":"Filter the live catalogue by category, brand, price and occasion.","itemCount":8}$json$::jsonb,
   $json${"type":"catalogue_grid","visible":true,"position":80,"heading":"Gift catalogue","subtext":"Filter the live catalogue by category, brand, price and occasion.","itemCount":8}$json$::jsonb,
   now())
on conflict (page, section_key) do nothing;


$seed$;
  r := r || jsonb_build_object('reseed_collections', (select count(*) from public.collections), 'reseed_sections', (select count(*) from public.homepage_sections));

  -- Rows exactly as the app will read them.
  r := r || jsonb_build_object(
    'section_rows', (select jsonb_agg(jsonb_build_object('id', id, 'section_key', section_key, 'section_type', section_type, 'draft', draft, 'published', published) order by section_key) from public.homepage_sections),
    'collection_rows', (select jsonb_agg(to_jsonb(c) - 'created_at' - 'updated_at' - 'updated_by' || jsonb_build_object('collection_products', '[]'::jsonb) order by position) from public.collections c),
    -- md5 of the jsonb text, compared with the built-in content by scripts/homepage-dry-run-compare.ts.
    'section_md5', (select jsonb_object_agg(section_key, md5(published::text)) from public.homepage_sections),
    'collection_md5', (select jsonb_object_agg(slug, md5((to_jsonb(c) - 'id' - 'created_at' - 'updated_at' - 'updated_by')::text)) from public.collections c)
  );

  -- anon: no access at all.
  v_ok := false;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    perform count(*) from public.homepage_sections;
  exception when insufficient_privilege then v_ok := true;
  end;
  execute 'reset role';
  r := r || jsonb_build_object('anon_blocked', v_ok);

  -- Signed-in non-admin: sees nothing, cannot write, cannot publish.
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', gen_random_uuid())::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.collections;
  r := r || jsonb_build_object('non_admin_sees_collections', v_count);
  v_ok := false;
  begin
    insert into public.collections (slug, title) values ('dry-run-x', 'X');
  exception when insufficient_privilege or check_violation then v_ok := true;
  end;
  r := r || jsonb_build_object('non_admin_insert_blocked', v_ok);
  v_ok := false;
  begin
    perform public.publish_homepage('retail_home');
  exception when insufficient_privilege then v_ok := true;
  end;
  r := r || jsonb_build_object('non_admin_publish_blocked', v_ok);
  execute 'reset role';

  -- Admin: edit a draft, add a slot, publish; then remove the slot and publish again.
  select id into v_admin from public.profiles where role = 'admin' and coalesce(is_active, true) order by created_at limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', v_admin)::text, true);
  execute 'set local role authenticated';
  select count(*) into v_count from public.collections;
  r := r || jsonb_build_object('admin_sees_collections', v_count);
  select id into v_section from public.homepage_sections where section_key = 'bestsellers';
  update public.homepage_sections set draft = jsonb_set(draft, '{heading}', '"Dry run heading"') where id = v_section;
  insert into public.homepage_slots (section_id, draft)
  values (v_section, '{"label":"Dry run","schedule":{"startsOn":"2026-10-20","endsOn":"2026-11-05"},"priority":1,"target":"section","overrides":{"heading":"Dry run slot"}}')
  returning id into v_slot;
  r := r || jsonb_build_object('admin_live_heading_before_publish', (select published->>'heading' from public.homepage_sections where id = v_section));
  r := r || jsonb_build_object('admin_publish_sections', public.publish_homepage('retail_home'));
  r := r || jsonb_build_object(
    'admin_live_heading_after_publish', (select published->>'heading' from public.homepage_sections where id = v_section),
    'slot_published', (select published is not null from public.homepage_slots where id = v_slot)
  );
  update public.homepage_slots set draft = null where id = v_slot;
  perform public.publish_homepage('retail_home');
  r := r || jsonb_build_object('slot_deleted_after_publish', not exists (select 1 from public.homepage_slots where id = v_slot));
  execute 'reset role';

  -- Rollback removes everything.
  execute $rb$
-- Rollback for 20261022_homepage_cms.sql (and its seed). Drops the four tables and the
-- publish function. Homepage edits made in the CRM are lost; take a copy first:
--   select * from public.collections; select * from public.collection_products;
--   select * from public.homepage_sections; select * from public.homepage_slots;
-- The storefront falls back to its built-in homepage and collections immediately.


drop function if exists public.publish_homepage(text);
drop table if exists public.homepage_slots;
drop table if exists public.homepage_sections;
drop table if exists public.collection_products;
drop table if exists public.collections;


$rb$;
  r := r || jsonb_build_object(
    'after_rollback_tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('collections', 'collection_products', 'homepage_sections', 'homepage_slots')),
    'after_rollback_function', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'publish_homepage')
  );

  r := r || jsonb_build_object('ok',
    (r->>'collections')::int = 12 and (r->>'sections')::int = 8 and (r->>'sections_published_equals_draft')::int = 8
    and (r->>'slots')::int = 0 and (r->>'rls_enabled')::int = 4 and (r->>'policies')::int = 4
    and (r->>'reseed_collections')::int = 12 and (r->>'reseed_sections')::int = 8
    and (r->>'anon_blocked')::boolean and (r->>'non_admin_sees_collections')::int = 0
    and (r->>'non_admin_insert_blocked')::boolean and (r->>'non_admin_publish_blocked')::boolean
    and (r->>'admin_sees_collections')::int = 12
    and r->>'admin_live_heading_before_publish' = 'Retail Bestsellers — Ready to Ship'
    and r->>'admin_live_heading_after_publish' = 'Dry run heading'
    and (r->>'slot_published')::boolean and (r->>'slot_deleted_after_publish')::boolean
    and (r->>'after_rollback_tables')::int = 0 and (r->>'after_rollback_function')::int = 0);

  raise exception 'DRYRUN_RESULT %', r::text;
end
$dry$;
