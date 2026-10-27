-- Rolls back the holdings ledger and the extra movement columns from
-- supabase/migrations/20261027_sample_internal_ledger.sql.
-- Staff-only policies on sample_stock and sample_movements stay, so this does not
-- publish sample stock to the retail store, the business portal, or company portals.
-- Not applied.

begin;

drop table if exists public.sample_holdings;

alter table public.sample_movements drop constraint if exists sample_movements_holder_profile_id_fkey;
alter table public.sample_movements drop constraint if exists sample_movements_condition_len;
drop index if exists public.sample_movements_holder_profile_idx;
alter table public.sample_movements drop column if exists holder_profile_id;
alter table public.sample_movements drop column if exists condition;

commit;
