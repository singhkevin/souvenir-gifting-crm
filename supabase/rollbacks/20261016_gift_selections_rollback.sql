-- Rollback for 20261016_gift_selections.sql
-- Does not remove the gift_employee enum value. Run 20261016_gift_employee_role_rollback.sql after this.

begin;

drop trigger if exists gift_submission_guard on public.gift_selection_submissions;
drop function if exists public.gift_submission_guard();

drop table if exists public.gift_selection_submissions;
drop table if exists public.gift_selection_combo_products;
drop table if exists public.gift_selection_items;
drop table if exists public.gift_selections;

drop function if exists public.gift_email_domain_ok(text, text[]);
drop function if exists public.is_gift_employee();
drop function if exists public.is_gift_staff();

commit;
