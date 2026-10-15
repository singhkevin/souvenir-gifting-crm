-- Employee gift selection: new app_role value only.
-- ALTER TYPE ... ADD VALUE must commit before 20261016_gift_selections.sql uses it.
-- Do not apply from the agent. Deliver for ops.
-- Rollback cannot drop an enum value. See supabase/rollbacks/20261016_gift_employee_role_rollback.sql.

alter type public.app_role add value if not exists 'gift_employee';
