-- Open B2B business portal: new app_role value only.
-- ALTER TYPE ... ADD VALUE must commit before any later migration uses the value.
-- Rollback cannot drop an enum value. See supabase/rollbacks/20261012_business_role_enum_rollback.sql.

alter type public.app_role add value if not exists 'business_user';
