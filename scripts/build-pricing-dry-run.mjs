// Builds supabase/tests/pricing_cost_basis_check.sql: snapshot every resolved price, apply the migration,
// snapshot again, apply the rollback, snapshot again, then raise with the comparison so nothing is kept.
// Usage: node scripts/build-pricing-dry-run.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const strip = (sql) => sql.replace(/^\s*begin;\s*$/im, '').replace(/^\s*commit;\s*$/im, '')
const schema = strip(readFileSync('supabase/migrations/20261022_pricing_cost_basis.sql', 'utf8'))
const cutover = strip(readFileSync('supabase/migrations/20261022_pricing_cost_basis_cutover.sql', 'utf8'))
const cutoverRollback = strip(readFileSync('supabase/rollbacks/20261022_pricing_cost_basis_cutover_rollback.sql', 'utf8'))
const schemaRollback = strip(readFileSync('supabase/rollbacks/20261022_pricing_cost_basis_rollback.sql', 'utf8'))

const TCS = '607b71d6-b58a-41ed-aa44-e3672f8b7c68'
const VIRAL = '8462149f-7a2a-4f6d-bd34-894604782060'
const ADMIN = 'bc6940e8-1d60-4519-b9ec-73eac5226ad7'
const STORE_PRODUCT = '096918f4-d95e-4688-92ab-9c337978501c' // macbook: active, in store, stock 12, MOQ 1, retail 1000, cost 900

// Objects origin/main depends on. Same md5 before and after step 1 = main sees no change.
const fingerprint = (table) => `
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
const simulation = `
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


const snapshot = (table) => `
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

const sql = `-- Dry run for 20261022_pricing_cost_basis.sql (step 1) and 20261022_pricing_cost_basis_cutover.sql (step 2).
-- Generated by scripts/build-pricing-dry-run.mjs; do not edit. Runs on live inside one transaction that always
-- raises, so nothing is kept. Compares every resolved price before, after step 1, after step 2 and after both
-- rollbacks, fingerprints the objects origin/main uses, and replays origin/main's writes and calls at each stage.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
${simulation}
${fingerprint('_fp_before')}
${snapshot('_snap_before')}
create temporary table _sim on commit drop as select 'before'::text as stage, pg_temp.sim_main() as result;

-- Step 1: schema only.
${schema}
select set_config('request.jwt.claim.role', 'service_role', true);
${fingerprint('_fp_schema')}
${snapshot('_snap_schema')}
insert into _sim select 'after_step1', pg_temp.sim_main();
-- Effective cost on every portal (and with no portal) must equal the stored cost on day one.
create temporary table _cost_check on commit drop as
select p.id, x.portal, (select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id) as manual,
       public.effective_product_cost(p.id, null, x.portal) as effective
from public.products p cross join (values (null::text), ('store'), ('business'), ('corporate')) as x(portal);
create temporary table _cost_source_check on commit drop as
select count(*) filter (where cost_source = 'portal_default') as portal_default, count(*) as total from public.product_costs;

-- Step 2: cutover.
${cutover}
select set_config('request.jwt.claim.role', 'service_role', true);
${snapshot('_snap_after')}
insert into _sim select 'after_step2', pg_temp.sim_main();
create temporary table _migrated on commit drop as
select 'portal_fixed' as kind, product_id, null::uuid as company_id, price from public.portal_product_prices where source = 'migrated_from_retail'
union all
select 'company_price', product_id, company_id, price from public.company_product_prices where source = 'migrated_from_retail';
-- Quote/order cost: old expression vs the patched one, per quotation.
create temporary table _quote_cost on commit drop as
select q.id,
  coalesce(sum(coalesce((select pc.supplier_cost from public.product_costs pc where pc.product_id = p.id), p.price * 0.62) * qi.quantity), 0) as old_cost,
  coalesce(sum(coalesce(public.effective_product_cost(p.id, qi.quantity::integer, public.company_pricing_portal(q.company_id)), 0) * qi.quantity), 0) as new_cost
from public.quotations q join public.quotation_items qi on qi.quotation_id = q.id join public.products p on p.id = qi.product_id
group by q.id;

${cutoverRollback}
select set_config('request.jwt.claim.role', 'service_role', true);
${snapshot('_snap_rb_cutover')}
${schemaRollback}
select set_config('request.jwt.claim.role', 'service_role', true);
${fingerprint('_fp_rollback')}
${snapshot('_snap_rollback')}
insert into _sim select 'after_rollbacks', pg_temp.sim_main();

do $dry$
declare
  v_report jsonb;
begin
  with keyed as (
    select b.kind, b.product_id, b.status, b.company_id, b.line_id, b.price as before_price,
           s1.price as step1_price, a.price as after_price, rc.price as rb_cutover_price, r.price as rollback_price
    from _snap_before b
    left join _snap_schema s1 on s1.kind = b.kind and s1.product_id = b.product_id
     and s1.company_id is not distinct from b.company_id and s1.line_id is not distinct from b.line_id
    left join _snap_after a on a.kind = b.kind and a.product_id = b.product_id
     and a.company_id is not distinct from b.company_id and a.line_id is not distinct from b.line_id
    left join _snap_rb_cutover rc on rc.kind = b.kind and rc.product_id = b.product_id
     and rc.company_id is not distinct from b.company_id and rc.line_id is not distinct from b.line_id
    left join _snap_rollback r on r.kind = b.kind and r.product_id = b.product_id
     and r.company_id is not distinct from b.company_id and r.line_id is not distinct from b.line_id
  )
  select jsonb_build_object(
    'rows', (select count(*) from _snap_before),
    'rows_step1', (select count(*) from _snap_schema),
    'rows_after', (select count(*) from _snap_after),
    'rows_rollback', (select count(*) from _snap_rollback),
    'step1_diffs_all_products', (select count(*) from keyed where before_price is distinct from step1_price),
    'active_diffs', (select count(*) from keyed where status = 'active' and before_price is distinct from after_price),
    'discontinued_diffs', (select count(*) from keyed where status <> 'active' and before_price is distinct from after_price),
    'rollback_cutover_diffs', (select count(*) from keyed where before_price is distinct from rb_cutover_price),
    'rollback_diffs', (select count(*) from keyed where before_price is distinct from rollback_price),
    'cost_diffs', (select count(*) from _cost_check where manual is distinct from effective),
    'cost_checks', (select count(*) from _cost_check),
    'cost_source', (select to_jsonb(c) from _cost_source_check c),
    'fingerprint_step1_changed', (select jsonb_agg(b.k) from _fp_before b join _fp_schema s on s.k = b.k where b.v is distinct from s.v),
    'fingerprint_rollback_changed', (select jsonb_agg(b.k) from _fp_before b left join _fp_rollback s on s.k = b.k where b.v is distinct from s.v),
    'fingerprint_keys', (select count(*) from _fp_before),
    'migrated', (select jsonb_object_agg(kind, n) from (select kind, count(*) n from _migrated group by kind) m),
    'quote_cost', (select jsonb_build_object('quotations', count(*), 'diffs', count(*) filter (where old_cost is distinct from new_cost),
        'sample', (select jsonb_agg(x) from (select id, old_cost, new_cost from _quote_cost where old_cost is distinct from new_cost limit 5) x)) from _quote_cost),
    'by_kind', (select jsonb_object_agg(kind, n) from (select kind, count(*) n from _snap_before group by kind) k),
    'active_diff_sample', (select jsonb_agg(x) from (select kind, product_id, company_id, line_id, before_price, after_price from keyed where status = 'active' and before_price is distinct from after_price limit 15) x),
    'discontinued_diff_products', (select count(distinct product_id) from keyed where status <> 'active' and before_price is distinct from after_price),
    'sim', (select jsonb_object_agg(stage, result) from _sim)
  ) into v_report;
  raise exception 'PRICING_DRY_RUN %', v_report::text;
end
$dry$;
rollback;
`
writeFileSync('supabase/tests/pricing_cost_basis_check.sql', sql)
console.log('wrote supabase/tests/pricing_cost_basis_check.sql', sql.length)
