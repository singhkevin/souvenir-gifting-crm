-- Indicative B2B price toggles. Costs stay off this surface; the app reads these flags
-- and resolves a sell price server-side.

alter table public.org_settings
  add column if not exists business_use_best_cost boolean not null default false,
  add column if not exists business_show_sell_price boolean not null default true;

comment on column public.org_settings.business_use_best_cost is
  'When true, the business catalogue sell price starts from the best supplier offer. The cost itself is never sent to the business portal.';
comment on column public.org_settings.business_show_sell_price is
  'When false, business users see Price on quote instead of an indicative sell price.';
