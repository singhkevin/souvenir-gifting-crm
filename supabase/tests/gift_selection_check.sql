-- Rolled-back check for employee gift selection.
-- Run in the SQL editor as postgres after 20261016_gift_employee_role.sql and
-- 20261016_gift_selections.sql. A failing assert raises and the transaction rolls back.
-- Do not remove the final rollback.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.gift_submission_guard()', 'execute') then
    raise exception 'anon must not execute gift_submission_guard';
  end if;
  if has_function_privilege('authenticated', 'public.gift_submission_guard()', 'execute') then
    raise exception 'authenticated must not execute gift_submission_guard';
  end if;
  if not public.gift_email_domain_ok('a@tkion.com', array['tkion.com']) then
    raise exception 'company domain should pass';
  end if;
  if public.gift_email_domain_ok('a@gmail.com', array['gmail.com', 'tkion.com']) then
    raise exception 'gmail must stay blocked even when listed';
  end if;
  if public.gift_email_domain_ok('a@yahoo.com', array['yahoo.com']) then
    raise exception 'yahoo must stay blocked';
  end if;
end $$;

create temp table gift_check_ids (
  employee_id uuid,
  size_id uuid,
  gmail_id uuid,
  company_id uuid,
  product_id uuid,
  selection_id uuid,
  item_id uuid,
  sized_id uuid
);

insert into gift_check_ids
select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

insert into public.companies (id, name, status)
select company_id, 'Gift Check Co', 'active' from gift_check_ids;

insert into public.products (id, name, sku, price, status, catalogue_access, moq)
select product_id, 'Gift Check Tee', 'GIFT-TEE-' || left(product_id::text, 8), 100, 'active', 'all', 1
from gift_check_ids;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', employee_id, 'authenticated', 'authenticated',
  'person@tkion.com', '', now(),
  jsonb_build_object('role', 'gift_employee', 'company_id', company_id),
  '{}'::jsonb, now(), now(), '', ''
from gift_check_ids
union all
select
  '00000000-0000-0000-0000-000000000000', size_id, 'authenticated', 'authenticated',
  'size@tkion.com', '', now(),
  jsonb_build_object('role', 'gift_employee', 'company_id', company_id),
  '{}'::jsonb, now(), now(), '', ''
from gift_check_ids
union all
select
  '00000000-0000-0000-0000-000000000000', gmail_id, 'authenticated', 'authenticated',
  'person@gmail.com', '', now(),
  jsonb_build_object('role', 'gift_employee', 'company_id', company_id),
  '{}'::jsonb, now(), now(), '', ''
from gift_check_ids;

insert into public.gift_selections (id, company_id, name, allowed_email_domains, opens_at, closes_at)
select selection_id, company_id, 'Welcome gift', array['tkion.com'], now() - interval '1 day', now() + interval '7 day'
from gift_check_ids;

insert into public.gift_selection_items (id, selection_id, kind, product_id, title, size_options, sort_order)
select item_id, selection_id, 'product', product_id, 'Notebook', '{}', 0 from gift_check_ids
union all
select sized_id, selection_id, 'product', product_id, 'Tee', array['S', 'M', 'L'], 1 from gift_check_ids;

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', employee_id, 'role', 'authenticated')::text from gift_check_ids),
  true
);
set local role authenticated;

insert into public.gift_selection_submissions (
  selection_id, employee_user_id, employee_email, employee_name, phone, address, city, state, pin, item_id, size, selected_label
)
select selection_id, employee_id, 'spoof@gmail.com', 'Asha Rao', '9876543210', '12 Lake Road', 'Pune', 'Maharashtra', '411001', item_id, null, 'spoof'
from gift_check_ids;

do $$
declare
  stored text;
begin
  select employee_email into stored from public.gift_selection_submissions limit 1;
  if stored <> 'person@tkion.com' then
    raise exception 'submission must store the profile email, got %', stored;
  end if;
end $$;

do $$
begin
  begin
    insert into public.gift_selection_submissions (
      selection_id, employee_user_id, employee_email, employee_name, phone, address, city, state, pin, item_id, selected_label
    )
    select selection_id, employee_id, 'person@tkion.com', 'Asha Rao', '9876543210', '12 Lake Road', 'Pune', 'Maharashtra', '411001', item_id, 'Notebook'
    from gift_check_ids;
    raise exception 'second submission should fail';
  exception when unique_violation then
    null;
  end;

  begin
    update public.gift_selection_submissions set city = 'Mumbai';
    raise exception 'update should be locked';
  exception when others then
    if sqlerrm not ilike '%locked%' then
      raise exception 'unexpected update error: %', sqlerrm;
    end if;
  end;

end $$;

select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', size_id, 'role', 'authenticated')::text from gift_check_ids),
  true
);

do $$
begin
  begin
    insert into public.gift_selection_submissions (
      selection_id, employee_user_id, employee_email, employee_name, phone, address, city, state, pin, item_id, size, selected_label
    )
    select selection_id, size_id, 'size@tkion.com', 'Size User', '9876543210', '12 Lake Road', 'Pune', 'Maharashtra', '411001', sized_id, null, 'Tee'
    from gift_check_ids;
    raise exception 'missing size should fail';
  exception when others then
    if sqlerrm not ilike '%size%' then
      raise exception 'unexpected size error: %', sqlerrm;
    end if;
  end;

  begin
    insert into public.gift_selection_submissions (
      selection_id, employee_user_id, employee_email, employee_name, phone, address, city, state, pin, item_id, size, selected_label
    )
    select selection_id, size_id, 'size@tkion.com', 'Size User', '987654321', '12 Lake Road', 'Pune', 'Maharashtra', '411001', item_id, null, 'Notebook'
    from gift_check_ids;
    raise exception 'short phone should fail';
  exception when others then
    if sqlerrm not ilike '%phone%' and sqlerrm not ilike '%check%' then
      raise exception 'unexpected phone error: %', sqlerrm;
    end if;
  end;
end $$;

-- A gmail profile cannot submit, even on a campaign that only lists the company domain.
select set_config(
  'request.jwt.claims',
  (select json_build_object('sub', gmail_id, 'role', 'authenticated')::text from gift_check_ids),
  true
);

do $$
begin
  begin
    insert into public.gift_selection_submissions (
      selection_id, employee_user_id, employee_email, employee_name, phone, address, city, state, pin, item_id, selected_label
    )
    select selection_id, gmail_id, 'person@gmail.com', 'Gmail User', '9876543210', '12 Lake Road', 'Pune', 'Maharashtra', '411001', item_id, 'Notebook'
    from gift_check_ids;
    raise exception 'gmail submission should fail';
  exception when others then
    if sqlerrm not ilike '%company email%' then
      raise exception 'unexpected gmail error: %', sqlerrm;
    end if;
  end;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

do $$
begin
  if (
    select count(*) from public.gift_selection_submissions
  ) <> 1 then
    raise exception 'exactly one submission should remain';
  end if;
end $$;

rollback;
