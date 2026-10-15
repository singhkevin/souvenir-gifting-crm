-- Rollback for 20261016_gift_employee_role.sql
--
-- PostgreSQL cannot drop a value from an enum. This does not remove 'gift_employee'.
-- It deactivates every gift employee and moves them off that role.
-- Apply the gift selection table rollback first, and only when no row still needs this role.

update public.profiles
set
  is_active = false,
  role = 'client_user',
  company_id = null,
  updated_at = now()
where role = 'gift_employee';
