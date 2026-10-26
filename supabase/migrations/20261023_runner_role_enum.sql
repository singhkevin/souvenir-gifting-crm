-- Order lifecycle v2, step 1 of 2: add the `runner` login role.
-- Apply in its own transaction BEFORE 20261023_order_line_lifecycle.sql
-- (a new enum value cannot be used in the transaction that adds it).
-- The value cannot be dropped; the rollback only deactivates runner profiles.
-- TODO(client): Vishal to confirm runners get their own login (default: yes, phone view only).
alter type public.app_role add value if not exists 'runner';
