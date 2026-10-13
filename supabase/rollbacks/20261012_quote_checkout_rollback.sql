-- Rollback for 20261012_quote_checkout.sql
-- Drops only the unique index this migration may have created.
-- Does not drop a pre-existing orders_quotation_id_key constraint.
-- Does not delete orders created from quote checkout.

drop trigger if exists quotation_items_lock_accepted on public.quotation_items;
drop function if exists public.guard_accepted_quotation_items();
drop function if exists public.place_quote_order(text, jsonb);
drop index if exists public.orders_quotation_id_unique;
drop table if exists public.quote_checkout_tokens;
