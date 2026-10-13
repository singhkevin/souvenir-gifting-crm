-- Rolled-back check for quotation line totals, client revision requests, and expiry.
-- Run in the SQL editor as postgres after 20261014_quote_line_totals.sql and
-- 20261014_quote_requests.sql. A failing assert raises and the transaction rolls back.
-- Do not remove the final rollback.
--
-- Items are inserted while the quotation is still a draft. Status is set to
-- accepted only after those inserts, because quotation_items_lock_accepted
-- rejects changes once the parent quotation is accepted.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.client_request_quote_revision(uuid, text)', 'execute') then
    raise exception 'anon must not execute client_request_quote_revision';
  end if;
  if has_function_privilege('public', 'public.client_request_quote_revision(uuid, text)', 'execute') then
    raise exception 'public must not execute client_request_quote_revision';
  end if;
  if not has_function_privilege('authenticated', 'public.client_request_quote_revision(uuid, text)', 'execute') then
    raise exception 'authenticated must execute client_request_quote_revision';
  end if;
  if has_function_privilege('anon', 'public.expire_quotations()', 'execute')
     or has_function_privilege('authenticated', 'public.expire_quotations()', 'execute') then
    raise exception 'expire_quotations is service_role only';
  end if;
  if not has_function_privilege('service_role', 'public.expire_quotations()', 'execute') then
    raise exception 'service_role must execute expire_quotations';
  end if;
  if position('expire_quotations' in pg_get_functiondef('public.expire_business_quotations()'::regprocedure)) = 0 then
    raise exception 'expire_business_quotations must cover every account type';
  end if;
end $$;

create temp table quote_flow_ids (
  client_id uuid,
  sales_id uuid,
  inactive_id uuid,
  company_id uuid,
  business_id uuid,
  product_id uuid,
  draft_id uuid,
  item_id uuid,
  sent_id uuid,
  expire_corp_id uuid,
  expire_biz_id uuid,
  keep_draft_id uuid,
  owned_company_id uuid,
  owned_quote_id uuid,
  owned_req_id uuid
);

insert into quote_flow_ids
select
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
  gen_random_uuid(), gen_random_uuid(), gen_random_uuid();

insert into public.companies (id, name, status, account_type, business_verification, portal_status)
select company_id, 'Quote Flow Corporate', 'active', 'corporate', null, 'active' from quote_flow_ids
union all
select business_id, 'Quote Flow Business', 'prospect', 'business', 'verified', 'active' from quote_flow_ids
union all
select owned_company_id, 'Quote Flow Inactive Owner', 'prospect', 'corporate', null, 'active' from quote_flow_ids;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', client_id, 'authenticated', 'authenticated',
  'qf-client-' || client_id::text || '@example.com', '', now(),
  jsonb_build_object('role', 'client_user', 'company_id', company_id),
  '{}'::jsonb, now(), now(), '', ''
from quote_flow_ids
union all
select
  '00000000-0000-0000-0000-000000000000', sales_id, 'authenticated', 'authenticated',
  'qf-sales-' || sales_id::text || '@example.com', '', now(),
  jsonb_build_object('role', 'sales'),
  '{}'::jsonb, now(), now(), '', ''
from quote_flow_ids
union all
select
  '00000000-0000-0000-0000-000000000000', inactive_id, 'authenticated', 'authenticated',
  'qf-inactive-' || inactive_id::text || '@example.com', '', now(),
  jsonb_build_object('role', 'sales'),
  '{}'::jsonb, now(), now(), '', ''
from quote_flow_ids;

insert into public.profiles (id, full_name, email, role, company_id, is_active)
select client_id, 'Quote Flow Client', 'qf-client-' || client_id::text || '@example.com', 'client_user', company_id, true
from quote_flow_ids
union all
select sales_id, 'Quote Flow Sales', 'qf-sales-' || sales_id::text || '@example.com', 'sales', null, true
from quote_flow_ids
union all
select inactive_id, 'Quote Flow Inactive', 'qf-inactive-' || inactive_id::text || '@example.com', 'sales', null, false
from quote_flow_ids
on conflict (id) do update
set full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    company_id = excluded.company_id,
    is_active = excluded.is_active;

insert into public.products (id, name, sku, price, status, catalogue_access, stock_qty, fulfillment_mode, moq)
select product_id, 'Quote Flow Pen', 'QF-' || replace(product_id::text, '-', ''), 100, 'active', 'all', 0, 'buy', 1
from quote_flow_ids;

-- Draft first. Lines are inserted before any quotation is marked accepted.
insert into public.quotations (
  id, quotation_number, company_id, owner_id, status, discount_percent, tax_percent, subtotal, total
)
select draft_id, 'QF-DRAFT-' || left(draft_id::text, 8), company_id, sales_id, 'draft', 10, 18, 0, 0
from quote_flow_ids
union all
select sent_id, 'QF-SENT-' || left(sent_id::text, 8), company_id, sales_id, 'sent', 0, 18, 0, 0
from quote_flow_ids
union all
select expire_corp_id, 'QF-EXPC-' || left(expire_corp_id::text, 8), company_id, sales_id, 'sent', 0, 0, 0, 0
from quote_flow_ids
union all
select expire_biz_id, 'QF-EXPB-' || left(expire_biz_id::text, 8), business_id, sales_id, 'viewed', 0, 0, 0, 0
from quote_flow_ids
union all
select keep_draft_id, 'QF-KEEP-' || left(keep_draft_id::text, 8), company_id, sales_id, 'draft', 0, 0, 0, 0
from quote_flow_ids
union all
select owned_quote_id, 'QF-OWN-' || left(owned_quote_id::text, 8), owned_company_id, inactive_id, 'draft', 0, 0, 0, 0
from quote_flow_ids;

insert into public.quotation_items (id, quotation_id, product_id, description, quantity, unit_price)
select item_id, draft_id, product_id, 'Quote Flow Pen', 2, 100 from quote_flow_ids;

update public.quotations
set valid_until = current_date - 1
where id in (select expire_corp_id from quote_flow_ids union all select expire_biz_id from quote_flow_ids);

insert into public.requirements (id, name, company_id, owner_id, status, source)
select owned_req_id, 'Quote Flow Req', owned_company_id, inactive_id, 'active', 'corporate_portal'
from quote_flow_ids;

update public.companies
set owner_id = (select inactive_id from quote_flow_ids)
where id = (select owned_company_id from quote_flow_ids);

update public.org_settings
set business_default_owner_id = (select sales_id from quote_flow_ids);

do $$
begin
  if not exists (
    select 1 from public.org_settings
    where business_default_owner_id = (select sales_id from quote_flow_ids)
  ) then
    raise exception 'org_settings row is required to test inactive owner reassignment';
  end if;
end $$;

select public.recalc_quotation_totals((select draft_id from quote_flow_ids));
select public.reassign_inactive_owners();

do $$
declare
  v_line numeric;
  v_total numeric;
  v_tax numeric;
  v_owner uuid;
begin
  select line_total into v_line from public.quotation_items where id = (select item_id from quote_flow_ids);
  if v_line is distinct from 180 then
    raise exception 'line_total % expected 180 (pre-tax after 10 percent)', v_line;
  end if;
  select total, tax_amount into v_total, v_tax
  from public.quotations where id = (select draft_id from quote_flow_ids);
  if v_tax is distinct from 32.40 or v_total is distinct from 212.40 then
    raise exception 'expected tax 32.40 and total 212.40, got tax % total %', v_tax, v_total;
  end if;

  select owner_id into v_owner from public.companies where id = (select owned_company_id from quote_flow_ids);
  if v_owner is distinct from (select sales_id from quote_flow_ids) then
    raise exception 'inactive company owner was not reassigned';
  end if;
  select owner_id into v_owner from public.quotations where id = (select owned_quote_id from quote_flow_ids);
  if v_owner is distinct from (select sales_id from quote_flow_ids) then
    raise exception 'inactive quotation owner was not reassigned';
  end if;
  select owner_id into v_owner from public.requirements where id = (select owned_req_id from quote_flow_ids);
  if v_owner is distinct from (select sales_id from quote_flow_ids) then
    raise exception 'inactive requirement owner was not reassigned';
  end if;
end $$;

-- Only now mark a copy accepted, and only after its line exists.
insert into public.quotations (
  id, quotation_number, company_id, owner_id, status, discount_percent, tax_percent, subtotal, total
)
select gen_random_uuid(), 'QF-ACC-' || left(draft_id::text, 8), company_id, sales_id, 'draft', 0, 0, 100, 100
from quote_flow_ids;

-- The accepted-lock quotation is the newest draft on this company besides the priced one.
-- Use a dedicated id stored by inserting with a known select.
create temp table quote_flow_accept (id uuid);
insert into quote_flow_accept
select id from public.quotations
where quotation_number = (select 'QF-ACC-' || left(draft_id::text, 8) from quote_flow_ids);

insert into public.quotation_items (id, quotation_id, product_id, description, quantity, unit_price, line_total)
select gen_random_uuid(), id, (select product_id from quote_flow_ids), 'Quote Flow Pen', 1, 100, 100
from quote_flow_accept;

update public.quotations set status = 'accepted' where id = (select id from quote_flow_accept);

do $$
begin
  begin
    update public.quotation_items
    set quantity = 9
    where quotation_id = (select id from quote_flow_accept);
    raise exception 'accepted quotation lines should be locked';
  exception
    when others then
      if sqlerrm not ilike '%locked%' then
        raise;
      end if;
  end;
end $$;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  (select jsonb_build_object('sub', client_id, 'role', 'authenticated')::text from quote_flow_ids),
  true
);

do $$
declare
  v_id uuid;
begin
  if not public.is_client() then
    raise exception 'fixture client must pass is_client()';
  end if;
  v_id := public.client_request_quote_revision((select sent_id from quote_flow_ids), 'Please change the colour');
  if v_id is distinct from (select sent_id from quote_flow_ids) then
    raise exception 'revision request returned the wrong quotation';
  end if;
  if not exists (
    select 1 from public.quotations
    where id = v_id
      and status = 'sent'
      and revision_requested_at is not null
      and client_comment = 'Please change the colour'
  ) then
    raise exception 'revision request did not keep the quote open with the client comment';
  end if;
  if public.client_request_quote_revision(v_id, 'Again') is distinct from v_id then
    raise exception 'a repeat revision request should return the same quotation';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;

do $$
declare
  v_count integer;
begin
  v_count := public.expire_quotations();
  if v_count < 2 then
    raise exception 'expire_quotations should expire corporate and business quotes, got %', v_count;
  end if;
  if (select status from public.quotations where id = (select expire_corp_id from quote_flow_ids)) is distinct from 'expired' then
    raise exception 'corporate quotation was not expired';
  end if;
  if (select status from public.quotations where id = (select expire_biz_id from quote_flow_ids)) is distinct from 'expired' then
    raise exception 'business quotation was not expired';
  end if;
  if (select status from public.quotations where id = (select keep_draft_id from quote_flow_ids)) is distinct from 'draft' then
    raise exception 'draft quotations must not expire';
  end if;
  if (select status from public.quotations where id = (select sent_id from quote_flow_ids)) is distinct from 'sent' then
    raise exception 'a sent quotation with no past valid_until must stay sent';
  end if;
end $$;

reset role;

rollback;
