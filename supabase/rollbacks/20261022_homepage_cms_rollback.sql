-- Rollback for 20261022_homepage_cms.sql (and its seed). Drops the four tables and the
-- publish function. Homepage edits made in the CRM are lost; take a copy first:
--   select * from public.collections; select * from public.collection_products;
--   select * from public.homepage_sections; select * from public.homepage_slots;
-- The storefront falls back to its built-in homepage and collections immediately.

begin;

drop function if exists public.publish_homepage(text);
drop table if exists public.homepage_slots;
drop table if exists public.homepage_sections;
drop table if exists public.collection_products;
drop table if exists public.collections;

commit;
