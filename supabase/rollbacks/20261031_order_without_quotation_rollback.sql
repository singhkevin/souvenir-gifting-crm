-- Rollback for 20261031_order_without_quotation.sql.
-- Drops the direct-order function and the without_quotation flag.
-- Orders created this way remain; they just lose the flag.
-- No begin/commit. Supabase applies this file in one transaction.

drop function if exists public.create_order_from_requirement(uuid, jsonb);

alter table public.orders drop constraint if exists orders_without_quotation_check;

alter table public.orders drop column if exists without_quotation;
