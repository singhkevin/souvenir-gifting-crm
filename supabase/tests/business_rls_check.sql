-- Manual isolation check for the business portal. Run in the SQL editor as postgres.
-- The whole script is one transaction and rolls back, including the fixture users.
--
-- How to run (Supabase SQL editor or psql against a database that already has the
-- business migrations applied):
--   paste this file and execute it.
-- A failing assert raises an exception and the transaction rolls back.
-- Do not remove the final rollback.

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'biz-a@example.com', '', now(), '{"role":"business_user"}'::jsonb, '{}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'biz-b@example.com', '', now(), '{"role":"business_user"}'::jsonb, '{}'::jsonb, now(), now(), '', '');

insert into public.companies (id, name, status, account_type, business_verification)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS Business A', 'prospect', 'business', 'unverified'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS Business B', 'prospect', 'business', 'verified'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'RLS Corporate', 'active', 'corporate', null);

insert into public.profiles (id, full_name, email, role, company_id, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'Biz A', 'biz-a@example.com', 'business_user', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true),
  ('22222222-2222-4222-8222-222222222222', 'Biz B', 'biz-b@example.com', 'business_user', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true)
on conflict (id) do update
set role = excluded.role,
    company_id = excluded.company_id,
    is_active = true;

insert into public.requirements (id, name, company_id, owner_id, status, source)
select 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'A only', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
       'active', 'business_portal'
where exists (select 1 from public.profiles where role = 'admin' and is_active);

insert into public.requirements (id, name, company_id, owner_id, status, source)
select 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'B only', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
       (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
       'active', 'business_portal'
where exists (select 1 from public.profiles where role = 'admin' and is_active);

insert into public.quotations (id, quotation_number, company_id, owner_id, status, subtotal, total)
select 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'RLS-A', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       (select id from public.profiles where role = 'admin' and is_active order by created_at limit 1),
       'sent', 0, 0
where exists (select 1 from public.profiles where role = 'admin' and is_active);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

do $$
declare
  v_req int;
  v_quote int;
  v_other_company int;
  v_orders int;
begin
  if public.is_client() then
    raise exception 'is_client() must be false for a business user';
  end if;
  if public.is_internal() then
    raise exception 'is_internal() must be false for a business user';
  end if;
  if not public.is_business() then
    raise exception 'is_business() must be true';
  end if;
  if public.business_company_id() is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid then
    raise exception 'business_company_id() returned the wrong company';
  end if;

  select count(*) into v_req from public.requirements;
  if v_req <> 1 then
    raise exception 'business user should see only their own requirement, saw %', v_req;
  end if;

  select count(*) into v_quote from public.quotations;
  if v_quote <> 1 then
    raise exception 'business user should see only their own sent quotation, saw %', v_quote;
  end if;

  select count(*) into v_other_company
  from public.companies
  where id <> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
  if v_other_company <> 0 then
    raise exception 'business user can see another company';
  end if;

  select count(*) into v_orders from public.orders;
  if v_orders <> 0 then
    raise exception 'business user should not see orders with no quotation';
  end if;

  if exists (select 1 from public.campaigns) then
    raise exception 'business user can read campaigns';
  end if;
  if exists (select 1 from public.catalog_assignments) then
    raise exception 'business user can read catalog_assignments';
  end if;
  if exists (select 1 from public.org_settings) then
    raise exception 'business user can read org_settings';
  end if;
  if exists (select 1 from public.product_supplier_offers) then
    raise exception 'business user can read product_supplier_offers';
  end if;
  if exists (select 1 from public.quotation_item_costs) then
    raise exception 'business user can read quotation_item_costs';
  end if;
end $$;

rollback;
