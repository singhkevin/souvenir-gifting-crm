-- Undoes 20261014_categories_unique.sql. Drops the staff insert policy only when
-- this migration created it (policy name categories_insert_staff).

begin;

drop policy if exists categories_insert_staff on public.categories;
drop index if exists public.categories_name_ci;

commit;
