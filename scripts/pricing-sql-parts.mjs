// Shared SQL pieces for the pricing dry run and the step 1 apply checks.
export const TCS = '607b71d6-b58a-41ed-aa44-e3672f8b7c68'
export const VIRAL = '8462149f-7a2a-4f6d-bd34-894604782060'
export const ADMIN = 'bc6940e8-1d60-4519-b9ec-73eac5226ad7'
export const STORE_PRODUCT = '096918f4-d95e-4688-92ab-9c337978501c' // macbook: active, in store, stock 12, MOQ 1, retail 1000, cost 900

// Objects origin/main depends on. Same md5 before and after step 1 = main sees no change.
export const fingerprint = (table) => `
create temporary table ${table} on commit drop as
select 'fn:' || p.oid::regprocedure::text as k, md5(pg_get_functiondef(p.oid)) as v
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('portal_unit_price', 'listed_unit_price', 'place_direct_order',
  'client_respond_quotation', 'convert_quotation_to_order', 'place_quote_order', 'best_supplier_cost', 'resolved_sell_price')
union all
select 'view:' || c.relname, md5(pg_get_viewdef(c.oid)) from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('client_products', 'portal_catalogue')
union all
select 'triggers:products', md5(coalesce(string_agg(t.tgname || pg_get_triggerdef(t.oid), ',' order by t.tgname), ''))
from pg_trigger t where t.tgrelid = 'public.products'::regclass and not t.tgisinternal
union all
select 'col:products.price', md5(coalesce(a.attnotnull::text, '') || coalesce(pg_get_expr(d.adbin, d.adrelid), ''))
from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
where a.attrelid = 'public.products'::regclass and a.attname = 'price'
union all
select 'data:products', md5(coalesce(string_agg(id::text || ':' || price::text || ':' || status::text, ',' order by id), '')) from public.products
union all
select 'data:product_costs', md5(coalesce(string_agg(product_id::text || ':' || coalesce(supplier_cost::text, '-'), ',' order by product_id), '')) from public.product_costs
union all
select 'data:company_product_prices', md5(coalesce(string_agg(company_id::text || product_id::text || price::text || coalesce(valid_until::text, '-'), ',' order by company_id, product_id), '')) from public.company_product_prices
union all
select 'data:portal_product_prices', md5(coalesce(string_agg(product_id::text || portal || price::text, ',' order by product_id, portal), '')) from public.portal_product_prices
union all
select 'data:org_settings', md5(coalesce(string_agg(
  concat_ws('|', s.store_price_base, s.business_price_base, s.corporate_price_base, s.store_margin_percent, s.business_margin_percent,
    s.corporate_margin_percent, s.store_no_cost_fallback, s.business_no_cost_fallback, s.corporate_no_cost_fallback,
    s.default_margin_percent, s.b2c_margin_percent, s.b2b_margin_percent, s.corporate_rounding), ','), '')) from public.org_settings s
union all
select 'data:price_change_log', count(*)::text from public.price_change_log
;
`

// What origin/main does against the database, run inside a sub-transaction that is always undone.
// Each step records its result or its error; nothing it writes survives.
export const simulation = `
create or replace function pg_temp.sim_main() returns jsonb language plpgsql as $sim$
declare
  r jsonb := '{}'::jsonb;
  v_pid uuid;
  v_nocost uuid;
  v_price numeric;
  v_company uuid;
  v_contact uuid;
  v_order uuid;
  v_quote uuid;
  v_claims text := current_setting('request.jwt.claims', true);
begin
  begin
    -- Order numbers come from a sequence, which a rollback does not undo. Inside this sub-transaction
    -- (always undone) use a throwaway number so the dry run leaves no gap in live order numbering.
    execute $nx$create or replace function public.next_order_number() returns text language sql as
      $q$ select 'DRYRUN-' || substr(md5(random()::text), 1, 10) $q$$nx$;
    -- CRM product create (main writes the retail price itself) and cost upsert.
    begin
      insert into public.products (name, sku, category_id, price, moq, stock_qty, status, catalogue_access, visibility)
      values ('DRYRUN main product', 'DRYRUN-MAIN-' || substr(md5(random()::text), 1, 8), (select id from public.categories limit 1),
              777, 10, 0, 'active', 'all', 'catalogue')
      returning id into v_pid;
      insert into public.product_costs (product_id, supplier_cost, updated_at) values (v_pid, 500, now())
      on conflict (product_id) do update set supplier_cost = excluded.supplier_cost, updated_at = excluded.updated_at;
      select price into v_price from public.products where id = v_pid;
      r := r || jsonb_build_object('create_ok', true, 'create_price_stored', v_price);
    exception when others then r := r || jsonb_build_object('create_error', sqlerrm);
    end;
    -- CRM product edit: retail price change.
    begin
      update public.products set price = 888 where id = v_pid;
      select price into v_price from public.products where id = v_pid;
      r := r || jsonb_build_object('edit_price_stored', v_price);
    exception when others then r := r || jsonb_build_object('edit_error', sqlerrm);
    end;
    -- What main shows (retail 888, Viral = 888 x 1.25) vs what the database charges for that product.
    begin
      r := r || jsonb_build_object(
        'new_product_corporate_db', public.listed_unit_price(null, v_pid, 888, null, null),
        'new_product_viral_db', public.listed_unit_price('${VIRAL}', v_pid, 888, 25, null),
        'new_product_tcs_db', public.listed_unit_price('${TCS}', v_pid, 888, 0, null),
        'new_product_store_db', public.portal_unit_price('store', v_pid, null, 888, null, null, null, null));
    exception when others then r := r || jsonb_build_object('price_error', sqlerrm);
    end;
    -- CSV import by an account without cost access: product with a price and no cost row.
    begin
      insert into public.products (name, sku, price, moq, status, catalogue_access, visibility)
      values ('DRYRUN no cost', 'DRYRUN-NOCOST-' || substr(md5(random()::text), 1, 8), 450, 1, 'active', 'all', 'catalogue')
      returning id into v_nocost;
      r := r || jsonb_build_object(
        'no_cost_corporate_db', public.listed_unit_price(null, v_nocost, 450, null, null),
        'no_cost_store_db', public.portal_unit_price('store', v_nocost, null, 450, null, null, null, null));
    exception when others then r := r || jsonb_build_object('no_cost_error', sqlerrm);
    end;
    -- Company special price upsert (special-price-actions: on conflict company_id, product_id).
    begin
      insert into public.company_product_prices (company_id, product_id, price, valid_until, updated_at)
      values ('${TCS}', v_pid, 600, null, now())
      on conflict (company_id, product_id) do update set price = excluded.price, valid_until = excluded.valid_until, updated_at = excluded.updated_at;
      r := r || jsonb_build_object('special_upsert_ok', true, 'special_tcs_db', public.listed_unit_price('${TCS}', v_pid, 888, 0, null));
    exception when others then r := r || jsonb_build_object('special_error', sqlerrm);
    end;
    -- Settings save (main's columns only).
    begin
      update public.org_settings set default_margin_percent = default_margin_percent, b2c_margin_percent = b2c_margin_percent,
        b2b_margin_percent = b2b_margin_percent, crm_use_best_cost = crm_use_best_cost, portal_use_best_cost = portal_use_best_cost,
        store_show_sell_price = store_show_sell_price, portal_show_sell_price = portal_show_sell_price;
      r := r || jsonb_build_object('settings_ok', true);
    exception when others then r := r || jsonb_build_object('settings_error', sqlerrm);
    end;
    -- Portal gift list reads (main's column list).
    begin
      perform v.id, v.name, v.sku, v.description, v.image_url, v.price, v.moq, v.category_name, v.brand_name, v.stock_qty, v.fulfillment_mode
      from public.client_products v limit 5;
      r := r || jsonb_build_object('client_products_ok', true);
    exception when others then r := r || jsonb_build_object('client_products_error', sqlerrm);
    end;
    -- Public store checkout: guest company + contact + place_direct_order (service role), as main does.
    begin
      insert into public.companies (name) values ('DRYRUN store buyer') returning id into v_company;
      insert into public.contacts (company_id, full_name, email) values (v_company, 'Dry Run', 'dryrun@example.invalid') returning id into v_contact;
      v_order := public.place_direct_order(v_company, v_contact, null, 'store', null,
        jsonb_build_array(jsonb_build_object('product_id', '${STORE_PRODUCT}', 'quantity', 1)), 'store');
      r := r || jsonb_build_object('store_order', (select jsonb_agg(jsonb_build_object('unit_price', oi.unit_price, 'line_total', oi.line_total))
        from public.order_items oi where oi.order_id = v_order),
        'store_order_cost', (select jsonb_object_agg(e.key, e.value) from public.orders o, jsonb_each(to_jsonb(o)) e
          where o.id = v_order and e.key ilike '%cost%'));
    exception when others then r := r || jsonb_build_object('store_order_error', sqlerrm);
    end;
    -- Corporate portal order for Viral Inbound (service role). place_direct_order builds an
    -- on-commit-drop temp table; in production each call is its own transaction, so drop it here.
    drop table if exists pg_temp._direct_lines;
    begin
      v_order := public.place_direct_order('${VIRAL}', null, null, 'portal', null,
        jsonb_build_array(jsonb_build_object('product_id', '${STORE_PRODUCT}', 'quantity', 1)), 'portal');
      r := r || jsonb_build_object('viral_order', (select jsonb_agg(jsonb_build_object('unit_price', oi.unit_price, 'line_total', oi.line_total))
        from public.order_items oi where oi.order_id = v_order),
        'viral_order_cost', (select jsonb_object_agg(e.key, e.value) from public.orders o, jsonb_each(to_jsonb(o)) e
          where o.id = v_order and e.key ilike '%cost%'));
    exception when others then r := r || jsonb_build_object('viral_order_error', sqlerrm);
    end;
    -- Staff converts an accepted quotation (CRM): exercises the order-cost statement.
    begin
      select q.id into v_quote from public.quotations q
      where exists (select 1 from public.quotation_items qi where qi.quotation_id = q.id and qi.product_id is not null)
        and not exists (select 1 from public.orders o where o.quotation_id = q.id)
      order by q.created_at desc limit 1;
      update public.quotations set status = 'accepted' where id = v_quote;
      perform set_config('request.jwt.claims', json_build_object('role', 'service_role', 'sub', '${ADMIN}')::text, true);
      perform set_config('request.jwt.claim.sub', '${ADMIN}', true);
      v_order := public.convert_quotation_to_order(v_quote);
      r := r || jsonb_build_object('convert_ok', v_order is not null, 'convert_order_cost',
        (select to_jsonb(o) -> 'total_cost' from public.orders o where o.id = v_order));
    exception when others then r := r || jsonb_build_object('convert_error', sqlerrm);
    end;
    raise exception 'SIM_UNDO';
  exception when others then
    if sqlerrm <> 'SIM_UNDO' then r := r || jsonb_build_object('sim_error', sqlerrm); end if;
  end;
  perform set_config('request.jwt.claims', coalesce(v_claims, '{"role":"service_role"}'), true);
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end
$sim$;
`


export const snapshot = (table) => `
create temporary table ${table} on commit drop as
with comp as (select id, margin_percent from public.companies),
cat_co as (
  select cp.id as cp_id, x.company_id
  from public.campaign_products cp
  join lateral (
    select c.company_id from public.campaigns c where c.id = cp.campaign_id and c.company_id is not null
    union select a.company_id from public.catalog_assignments a where a.campaign_id = cp.campaign_id
    union select cp.priced_company_id where cp.priced_company_id is not null
  ) x on true
)
select 'store'::text as kind, p.id as product_id, p.status::text as status, null::uuid as company_id, null::uuid as line_id,
       public.portal_unit_price('store', p.id, null, p.price, null, null, null, null) as price
from public.products p
union all
select 'business', p.id, p.status::text, null, null,
       public.portal_unit_price('business', p.id, null, p.price, null, null, null, null)
from public.products p
union all
select 'business_company', p.id, p.status::text, c.id, null,
       public.portal_unit_price('business', p.id, c.id, p.price, null, c.margin_percent, null, null)
from public.products p cross join comp c
union all
select 'corporate', p.id, p.status::text, null, null,
       public.portal_unit_price('corporate', p.id, null, p.price, null, null, null, null)
from public.products p
union all
select 'corporate_company', p.id, p.status::text, c.id, null,
       public.listed_unit_price(c.id, p.id, p.price, c.margin_percent, null)
from public.products p cross join comp c
union all
select 'catalog_line', p.id, p.status::text, cc.company_id, cp.id,
       case when cp.pack_option is not null then cp.selling_price
            else public.listed_unit_price(cc.company_id, p.id, p.price, c.margin_percent, cp.manual_price) end
from public.campaign_products cp
join public.products p on p.id = cp.product_id
join cat_co cc on cc.cp_id = cp.id
join comp c on c.id = cc.company_id
union all
select 'client_products_view', v.id, 'active', null, null, v.price from public.client_products v
;
`

