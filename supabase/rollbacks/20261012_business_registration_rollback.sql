-- Rollback for 20261012_business_registration.sql
-- Does not delete companies, contacts, or leads already created.

drop function if exists public.register_business_account(jsonb, jsonb);
drop function if exists public.hit_rate_limit(text, integer, integer);
drop table if exists public.rate_limit_hits;
alter table public.org_settings drop column if exists business_default_owner_id;
