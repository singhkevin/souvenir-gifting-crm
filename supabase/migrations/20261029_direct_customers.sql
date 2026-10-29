-- Direct customers: staff-handled companies and individuals with no microsite.
-- Does not update existing rows. account_type stays corporate or business for them.
-- is_individual defaults to false. company_id on requirements, quotations, orders,
-- leads, and contacts stays required. Not applied to the live database.

alter table public.companies
  add column if not exists is_individual boolean not null default false;

alter table public.companies drop constraint if exists companies_account_type_check;
alter table public.companies
  add constraint companies_account_type_check
  check (account_type in ('corporate', 'business', 'direct'));

alter table public.companies drop constraint if exists companies_direct_individual_check;
alter table public.companies
  add constraint companies_direct_individual_check
  check (is_individual = false or account_type = 'direct');

alter table public.companies drop constraint if exists companies_direct_no_portal;
alter table public.companies
  add constraint companies_direct_no_portal
  check (
    account_type <> 'direct'
    or (
      portal_slug is null
      and coalesce(cardinality(allowed_email_domains), 0) = 0
    )
  );

comment on column public.companies.account_type is
  'corporate (microsite client), business (/business account), or direct (staff-handled, no microsite).';
comment on column public.companies.is_individual is
  'True when a direct customer is a person. The company name is that person and they have one primary contact. False on every existing row.';

-- Pricing stays on company_pricing_portal: only account_type = business uses the
-- business surface. Direct customers price as corporate. That function is not replaced here.
