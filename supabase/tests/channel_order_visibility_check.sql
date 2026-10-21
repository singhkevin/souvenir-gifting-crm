-- Rolled-back check: a business user can read their own direct order.
-- Run in the SQL editor as postgres after 20261022_channel_order_visibility.sql.
-- A failing assert raises and the transaction rolls back. Do not remove the final rollback.
--
-- Expects:
--   the signed-in business user sees the order with a null quotation_id on their company
--   the same user does not see another company's direct order or its items

begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '56565656-5656-4565-8565-565656565656',
  'authenticated',
  'authenticated',
  'visibility-biz@example.com',
  '',
  now(),
  '{"role":"business_user"}'::jsonb,
  '{}'::jsonb,
  now(),
  now(),
  '',
  ''
);

insert into public.companies (id, name, status, account_type, business_verification)
values
  ('12121212-1212-4121-8121-121212121212', 'Visibility Business A', 'prospect', 'business', 'verified'),
  ('34343434-3434-4343-8343-343434343434', 'Visibility Business B', 'prospect', 'business', 'verified');

insert into public.profiles (id, full_name, email, role, company_id, is_active)
values (
  '56565656-5656-4565-8565-565656565656',
  'Visibility Biz',
  'visibility-biz@example.com',
  'business_user',
  '12121212-1212-4121-8121-121212121212',
  true
)
on conflict (id) do update
set role = excluded.role,
    company_id = excluded.company_id,
    is_active = true;

insert into public.products (id, name, sku, price, status, catalogue_access, stock_qty, fulfillment_mode, moq)
values (
  'abababab-abab-4aba-8aba-abababababab',
  'Visibility Pen',
  'VIS-PEN',
  100,
  'active',
  'all',
  0,
  'buy',
  1
);

insert into public.orders (
  id, order_number, company_id, owner_id, quotation_id, status, order_value, source, notes
)
values
  (
    '78787878-7878-4787-8787-787878787878',
    'VIS-OWN',
    '12121212-1212-4121-8121-121212121212',
    '56565656-5656-4565-8565-565656565656',
    null,
    'created',
    100,
    'business',
    'Direct purchase with no quotation.'
  ),
  (
    '90909090-9090-4909-8909-909090909090',
    'VIS-OTHER',
    '34343434-3434-4343-8343-343434343434',
    '56565656-5656-4565-8565-565656565656',
    null,
    'created',
    200,
    'business',
    'Another company direct purchase.'
  );

insert into public.order_items (id, order_id, product_id, description, quantity, unit_price, line_total)
values
  (
    'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd',
    '78787878-7878-4787-8787-787878787878',
    'abababab-abab-4aba-8aba-abababababab',
    'Visibility Pen',
    1,
    100,
    100
  ),
  (
    'efefefef-efef-4efe-8efe-efefefefefef',
    '90909090-9090-4909-8909-909090909090',
    'abababab-abab-4aba-8aba-abababababab',
    'Visibility Pen',
    1,
    200,
    200
  );

do $$
declare
  v_src text;
  v_orders text;
  v_items text;
begin
  select pg_get_functiondef(p.oid) into v_src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'place_direct_order';

  if v_src is null or position('/business/orders/' in v_src) = 0 then
    raise exception 'place_direct_order must link a business order to /business/orders/<id>';
  end if;
  if position('v_source is distinct from ''store''' in v_src) = 0 then
    raise exception 'place_direct_order must skip the client notification for a store guest';
  end if;

  select pg_get_expr(pol.polqual, pol.polrelid) into v_orders
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'orders'
    and pol.polname = 'orders_select_business';
  if v_orders is null or position('quotation_id' in v_orders) > 0 then
    raise exception 'orders_select_business must not require quotation_id';
  end if;

  select pg_get_expr(pol.polqual, pol.polrelid) into v_items
  from pg_policy pol
  join pg_class c on c.oid = pol.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'order_items'
    and pol.polname = 'order_items_select_business';
  if v_items is null or position('quotation_id' in v_items) > 0 then
    raise exception 'order_items_select_business must not require quotation_id';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"56565656-5656-4565-8565-565656565656","role":"authenticated"}', true);

do $$
declare
  v_orders int;
  v_items int;
  v_other int;
begin
  if not public.is_business() then
    raise exception 'is_business() must be true';
  end if;
  if public.business_company_id() is distinct from '12121212-1212-4121-8121-121212121212'::uuid then
    raise exception 'business_company_id() returned the wrong company';
  end if;

  select count(*) into v_orders
  from public.orders
  where id = '78787878-7878-4787-8787-787878787878'
    and quotation_id is null;
  if v_orders <> 1 then
    raise exception 'business user should see their own order with a null quotation_id, saw %', v_orders;
  end if;

  select count(*) into v_other
  from public.orders
  where company_id = '34343434-3434-4343-8343-343434343434'
     or id = '90909090-9090-4909-8909-909090909090';
  if v_other <> 0 then
    raise exception 'business user can see another company order';
  end if;

  select count(*) into v_items
  from public.order_items
  where order_id = '78787878-7878-4787-8787-787878787878';
  if v_items <> 1 then
    raise exception 'business user should see items on their own direct order, saw %', v_items;
  end if;

  if exists (
    select 1 from public.order_items
    where order_id = '90909090-9090-4909-8909-909090909090'
  ) then
    raise exception 'business user can see another company order items';
  end if;
end $$;

rollback;
