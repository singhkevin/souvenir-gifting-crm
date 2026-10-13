-- Rollback for 20261012_business_accounts_foundation.sql
-- Does not remove the business_user enum value. Run the enum rollback note first
-- if business users should be deactivated.

drop policy if exists notifications_update_business on public.notifications;
drop policy if exists notifications_select_business on public.notifications;
drop policy if exists order_items_select_business on public.order_items;
drop policy if exists orders_select_business on public.orders;
drop policy if exists quotation_items_select_business on public.quotation_items;
drop policy if exists quotations_select_business on public.quotations;
drop policy if exists requirement_products_select_business on public.requirement_products;
drop policy if exists requirements_select_business on public.requirements;
drop policy if exists contacts_select_business on public.contacts;
drop policy if exists companies_select_business on public.companies;

drop function if exists public.business_company_id();
drop function if exists public.is_business();

alter table public.companies drop constraint if exists companies_business_verification_check;
alter table public.companies drop constraint if exists companies_account_type_check;

alter table public.companies drop column if exists business_verified_by;
alter table public.companies drop column if exists business_verified_at;
alter table public.companies drop column if exists business_verification;
alter table public.companies drop column if exists account_type;
