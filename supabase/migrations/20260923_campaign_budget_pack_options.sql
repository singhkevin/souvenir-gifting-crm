-- Phase 2: budget pack options (Option A / B / C) on campaign offerings.

alter table public.campaign_products
  add column if not exists pack_option text;

alter table public.campaign_products
  drop constraint if exists campaign_products_pack_option_check;

alter table public.campaign_products
  add constraint campaign_products_pack_option_check
  check (pack_option is null or pack_option in ('A', 'B', 'C'));

comment on column public.campaign_products.pack_option is
  'When set, groups auto-generated budget pack choices for client comparison (A/B/C).';

create index if not exists campaign_products_campaign_pack_idx
  on public.campaign_products (campaign_id, pack_option);
