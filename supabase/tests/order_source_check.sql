-- Rolled-back check for order source and the first history row.
-- Run in the SQL editor as postgres after 20261014_order_source.sql.
-- A failing assert raises and the transaction rolls back. Do not remove the final rollback.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb, text)', 'execute') then
    raise exception 'anon must not execute place_direct_order';
  end if;
  if has_function_privilege('anon', 'public.client_respond_quotation(uuid, text, text, uuid[])', 'execute') then
    raise exception 'anon must not execute client_respond_quotation';
  end if;
  if has_function_privilege('anon', 'public.convert_quotation_to_order(uuid)', 'execute') then
    raise exception 'anon must not execute convert_quotation_to_order';
  end if;
  if has_function_privilege('anon', 'public.place_quote_order(text, jsonb)', 'execute') then
    raise exception 'anon must not execute place_quote_order';
  end if;
  if not has_function_privilege('authenticated', 'public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb, text)', 'execute') then
    raise exception 'authenticated must keep execute on place_direct_order';
  end if;
  if not has_function_privilege('service_role', 'public.place_direct_order(uuid, uuid, uuid, text, uuid, jsonb, text)', 'execute') then
    raise exception 'service_role must keep execute on place_direct_order';
  end if;
  if has_function_privilege('authenticated', 'public.place_quote_order(text, jsonb)', 'execute') then
    raise exception 'authenticated must not execute place_quote_order';
  end if;
end $$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'source-client@example.com', '', now(), '{"role":"client_user"}'::jsonb, '{}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'source-sales@example.com', '', now(), '{"role":"sales"}'::jsonb, '{}'::jsonb, now(), now(), '', '');

insert into public.companies (id, name, status, account_type, business_verification, portal_status)
values
  ('33333333-3333-4333-8333-333333333333', 'Source Store Co', 'prospect', 'corporate', null, 'active'),
  ('44444444-4444-4444-8444-444444444444', 'Source Portal Co', 'active', 'corporate', null, 'active'),
  ('55555555-5555-4555-8555-555555555555', 'Source Business Co', 'prospect', 'business', 'verified', 'active');

insert into public.profiles (id, full_name, email, role, company_id, is_active)
values
  ('11111111-1111-4111-8111-111111111111', 'Source Client', 'source-client@example.com', 'client_user', '44444444-4444-4444-8444-444444444444', true),
  ('22222222-2222-4222-8222-222222222222', 'Source Sales', 'source-sales@example.com', 'sales', null, true)
on conflict (id) do update
set role = excluded.role, company_id = excluded.company_id, is_active = true;

insert into public.products (id, name, sku, price, status, catalogue_access, stock_qty, fulfillment_mode, moq)
values (
  '66666666-6666-4666-8666-666666666666',
  'Source Pen',
  'SOURCE-PEN',
  100,
  'active',
  'all',
  0,
  'buy',
  1
);

insert into public.quotations (id, quotation_number, company_id, owner_id, status, subtotal, total, discount_percent, tax_percent)
values
  ('77777777-7777-4777-8777-777777777777', 'SRC-PORTAL', '44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'sent', 100, 100, 0, 0),
  ('88888888-8888-4888-8888-888888888888', 'SRC-CRM', '44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'accepted', 100, 100, 0, 0),
  ('99999999-9999-4999-8999-999999999999', 'SRC-BIZ', '55555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222', 'accepted', 100, 100, 0, 0);

insert into public.quotation_items (id, quotation_id, product_id, description, quantity, unit_price, client_response)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '77777777-7777-4777-8777-777777777777', '66666666-6666-4666-8666-666666666666', 'Source Pen', 1, 100, null),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '88888888-8888-4888-8888-888888888888', '66666666-6666-4666-8666-666666666666', 'Source Pen', 1, 100, 'accepted'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '99999999-9999-4999-8999-999999999999', '66666666-6666-4666-8666-666666666666', 'Source Pen', 1, 100, 'accepted');

insert into public.quote_checkout_tokens (quotation_id, company_id, token_hash, expires_at)
values (
  '99999999-9999-4999-8999-999999999999',
  '55555555-5555-4555-8555-555555555555',
  'source-checkout-token-hash-0123456789abcdef',
  now() + interval '1 day'
);

select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_store uuid;
  v_business uuid;
begin
  v_store := public.place_direct_order(
    '33333333-3333-4333-8333-333333333333',
    null,
    '22222222-2222-4222-8222-222222222222',
    'store',
    null,
    jsonb_build_array(jsonb_build_object('product_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1)),
    null
  );
  if (select source from public.orders where id = v_store) is distinct from 'store' then
    raise exception 'guest place_direct_order source should be store';
  end if;
  if not exists (
    select 1 from public.order_status_history
    where order_id = v_store and from_status is null and to_status = 'created' and note = 'store'
  ) then
    raise exception 'guest place_direct_order is missing the created history row';
  end if;
end $$;

reset role;
drop table if exists _direct_lines;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_business uuid;
begin
  v_business := public.place_direct_order(
    '55555555-5555-4555-8555-555555555555',
    null,
    '22222222-2222-4222-8222-222222222222',
    'store',
    null,
    jsonb_build_array(jsonb_build_object('product_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1)),
    'business'
  );
  if (select source from public.orders where id = v_business) is distinct from 'business' then
    raise exception 'p_source business was not stored';
  end if;
  if not exists (
    select 1 from public.order_status_history
    where order_id = v_business and to_status = 'created' and note = 'business'
  ) then
    raise exception 'business direct order is missing the created history row';
  end if;
end $$;

reset role;
drop table if exists _direct_lines;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
begin
  begin
    perform public.place_direct_order(
      '44444444-4444-4444-8444-444444444444',
      null,
      '22222222-2222-4222-8222-222222222222',
      'portal',
      null,
      jsonb_build_array(jsonb_build_object('product_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1)),
      'crm'
    );
    raise exception 'a portal client must not set source crm';
  exception
    when others then
      if sqlerrm not ilike '%Not permitted to set this order source%' then
        raise;
      end if;
  end;
end $$;

reset role;
drop table if exists _direct_lines;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_portal uuid;
  v_accept uuid;
begin
  v_portal := public.place_direct_order(
    '44444444-4444-4444-8444-444444444444',
    null,
    '22222222-2222-4222-8222-222222222222',
    'portal',
    null,
    jsonb_build_array(jsonb_build_object('product_id', '66666666-6666-4666-8666-666666666666', 'quantity', 1)),
    'microsite'
  );
  if (select source from public.orders where id = v_portal) is distinct from 'microsite' then
    raise exception 'client p_source microsite was not stored';
  end if;

  v_accept := public.client_respond_quotation(
    '77777777-7777-4777-8777-777777777777',
    'accepted',
    null,
    array['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1']::uuid[]
  );
  if (select source from public.orders where id = v_accept) is distinct from 'portal' then
    raise exception 'client_respond_quotation source should be portal';
  end if;
  if not exists (
    select 1 from public.order_status_history
    where order_id = v_accept and from_status is null and to_status = 'created' and note = 'portal'
  ) then
    raise exception 'accepted quotation is missing the created history row';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_crm uuid;
begin
  v_crm := public.convert_quotation_to_order('88888888-8888-4888-8888-888888888888');
  if (select source from public.orders where id = v_crm) is distinct from 'crm' then
    raise exception 'convert_quotation_to_order source should be crm';
  end if;
  if not exists (
    select 1 from public.order_status_history
    where order_id = v_crm and from_status is null and to_status = 'created' and note = 'crm'
  ) then
    raise exception 'converted order is missing the created history row';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_quote uuid;
begin
  v_quote := public.place_quote_order('source-checkout-token-hash-0123456789abcdef', '{}'::jsonb);
  if (select source from public.orders where id = v_quote) is distinct from 'business' then
    raise exception 'place_quote_order source should be business';
  end if;
  if not exists (
    select 1 from public.order_status_history
    where order_id = v_quote and from_status is null and to_status = 'created' and note = 'business'
  ) then
    raise exception 'quote checkout is missing the created history row';
  end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform public.place_direct_order(
      '33333333-3333-4333-8333-333333333333', null, null, 'store', null, '[]'::jsonb, null
    );
    raise exception 'anon call to place_direct_order should fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
  begin
    perform public.place_quote_order('source-checkout-token-hash-0123456789abcdef', '{}'::jsonb);
    raise exception 'anon call to place_quote_order should fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm not ilike '%permission denied%' then
        raise;
      end if;
  end;
end $$;

rollback;
