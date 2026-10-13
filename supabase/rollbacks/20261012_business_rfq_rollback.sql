-- Rollback for 20261012_business_rfq.sql
-- Leaves existing requirement rows in place. Drops the new columns and the RPC.

drop function if exists public.business_submit_rfq(text, jsonb, date, text, numeric, text, text);

alter table public.requirement_products drop constraint if exists requirement_products_target_unit_price_check;
alter table public.requirement_products drop column if exists alt_quantities;
alter table public.requirement_products drop column if exists target_unit_price;
-- notes is not dropped: the column may already have existed before this migration.

drop index if exists public.requirements_company_client_request_id_key;
alter table public.requirements drop constraint if exists requirements_source_check;
alter table public.requirements drop column if exists client_request_id;
alter table public.requirements drop column if exists source;
