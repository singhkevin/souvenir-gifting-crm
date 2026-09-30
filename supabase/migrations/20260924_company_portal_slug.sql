-- Optional branded portal host: https://{portal_slug}.{ROOT_DOMAIN}
-- Null keeps the company on the main site at /portal.

alter table public.companies
  add column if not exists portal_slug text;

comment on column public.companies.portal_slug is
  'Lowercase host label for the company portal. Null means the company uses the main site.';

create unique index if not exists companies_portal_slug_key
  on public.companies (portal_slug);
