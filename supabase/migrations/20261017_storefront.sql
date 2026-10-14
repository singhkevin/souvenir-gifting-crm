-- Storefront brand logos and occasion tags. Do not apply from the agent.

begin;

alter table public.brands
  add column if not exists logo_url text;

alter table public.products
  add column if not exists occasion_tags text[] not null default '{}';

comment on column public.brands.logo_url is
  'Optional logo shown on the public store brand row.';

comment on column public.products.occasion_tags is
  'Storefront occasion filters: welcome, festive, onboarding, client, conference, anniversary.';

commit;
