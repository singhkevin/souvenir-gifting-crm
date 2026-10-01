-- Rollback for 20261001_portal_hosts.sql
-- Does NOT unpark anything on Hostinger.
begin;

drop trigger if exists companies_unpark_portal_hosts_on_delete on public.companies;
drop function if exists public.companies_unpark_portal_hosts_on_delete();

drop trigger if exists companies_sync_portal_hosts on public.companies;
drop function if exists public.companies_sync_portal_hosts();

drop function if exists public.claim_portal_host_jobs(integer, integer, uuid);
drop function if exists public.portal_hosts_assert_slug_available(text, uuid);
drop function if exists public.portal_host_hostname(text);

drop trigger if exists portal_hosts_touch_updated_at on public.portal_hosts;
drop function if exists public.portal_hosts_touch_updated_at();

drop policy if exists portal_host_runs_select on public.portal_host_runs;
drop policy if exists portal_hosts_select on public.portal_hosts;

drop table if exists public.portal_host_runs;
drop table if exists public.portal_hosts;

commit;
