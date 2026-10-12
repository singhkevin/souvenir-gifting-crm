-- Rollback for 20261012_business_role_enum.sql
--
-- PostgreSQL cannot drop a value from an enum. This does not remove 'business_user'.
-- It deactivates every business user and moves them off the business role so the
-- account foundation rollback can drop business-only objects afterwards.
-- Apply this only when no row still needs the business_user role.

update public.profiles
set
  is_active = false,
  role = 'client_user',
  company_id = null,
  updated_at = now()
where role = 'business_user';
