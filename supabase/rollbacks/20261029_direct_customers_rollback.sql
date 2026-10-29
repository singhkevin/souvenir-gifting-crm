-- Rollback for 20261029_direct_customers.sql.
-- Refuses to run while any direct customer exists, so those rows are not relabelled
-- and existing corporate and business rows are left as they are.
-- Not applied to the live database.

do $$
begin
  if exists (select 1 from public.companies where account_type = 'direct') then
    raise exception 'direct customers exist; move them off account_type direct before rolling back';
  end if;
end $$;

alter table public.companies drop constraint if exists companies_direct_no_portal;
alter table public.companies drop constraint if exists companies_direct_individual_check;

alter table public.companies drop constraint if exists companies_account_type_check;
alter table public.companies
  add constraint companies_account_type_check
  check (account_type in ('corporate', 'business'));

alter table public.companies drop column if exists is_individual;

comment on column public.companies.account_type is
  'corporate (default) or business. Business rows are open B2B accounts, not corporate portal clients.';
