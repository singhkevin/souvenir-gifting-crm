-- Multi-item budget kits: several campaign_product rows share one pack_kit_id.

alter table public.campaign_products
  add column if not exists pack_kit_id uuid,
  add column if not exists pack_kit_role text,
  add column if not exists pack_kit_total numeric;

alter table public.campaign_products
  drop constraint if exists campaign_products_pack_kit_role_check;

alter table public.campaign_products
  add constraint campaign_products_pack_kit_role_check
  check (pack_kit_role is null or pack_kit_role in ('primary', 'line'));

comment on column public.campaign_products.pack_kit_id is
  'Groups multiple products into one budget pack option (A/B/C).';
comment on column public.campaign_products.pack_kit_role is
  'primary = client-facing kit card & shortlist target; line = included item.';
comment on column public.campaign_products.pack_kit_total is
  'On primary kit row only: combined per-person price for the whole kit.';

create index if not exists campaign_products_pack_kit_idx
  on public.campaign_products (campaign_id, pack_kit_id);
