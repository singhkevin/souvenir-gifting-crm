-- Rollback for 20260930_tenant_status_and_slug.sql
-- Does not touch companies.status (prospect|active|inactive).

drop trigger if exists companies_portal_slug_history on public.companies;
drop function if exists public.companies_record_slug_history();

drop policy if exists slug_history_select on public.slug_history;
drop policy if exists slug_history_insert on public.slug_history;
drop policy if exists slug_history_update on public.slug_history;
drop policy if exists slug_history_delete on public.slug_history;

drop table if exists public.slug_history;

alter table public.companies drop constraint if exists companies_portal_slug_format_check;
alter table public.companies drop constraint if exists companies_subdomain_status_check;
alter table public.companies drop constraint if exists companies_portal_status_check;

alter table public.companies drop column if exists portal_status;
alter table public.companies drop column if exists trial_ends_at;
alter table public.companies drop column if exists subdomain_status;
alter table public.companies drop column if exists subdomain_attempts;
alter table public.companies drop column if exists subdomain_last_error;
alter table public.companies drop column if exists subdomain_updated_at;
