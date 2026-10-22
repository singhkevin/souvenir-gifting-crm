do $dry$
declare
  r jsonb := '{}'::jsonb;
  j jsonb;
  u record;
  n int; n2 int; tot int;
  m text; agg text;
begin
  set local lock_timeout = '3s';
  set local statement_timeout = '60s';
  -- snapshot before
  execute format($q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products where status='active' and %s$q$, $c$catalogue_access = 'all'$c$) into j;
  r := r || jsonb_build_object('before_retail', j);
  execute format($q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products where status='active' and %s$q$, $c$catalogue_access = 'all'$c$) into j;
  r := r || jsonb_build_object('before_business', j);
  select jsonb_build_object('pairs',count(*),'companies',count(distinct c.id),'md5',md5(coalesce(string_agg(c.id::text||':'||p.id::text, ',' order by c.id, p.id),'')))
    into j
    from public.companies c cross join public.products p
   where p.status='active'
     and not exists (select 1 from public.company_product_exclusions e where e.company_id=c.id and e.product_id=p.id)
     and (p.catalogue_access='all' or (p.catalogue_access='selected' and exists (select 1 from public.company_product_access a where a.company_id=c.id and a.product_id=p.id)));
  r := r || jsonb_build_object('before_corporate_logic', j);
  set local role anon;
  execute $q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products$q$ into j;
  reset role;
  r := r || jsonb_build_object('before_anon_rls', j);
  agg := '';
  tot := 0;
  for u in select id from public.profiles where role in ('client_admin','client_user') and is_active order by id loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    set local role authenticated;
    execute $q$select count(*)::int, md5(coalesce(string_agg(id::text, ',' order by id),'')) from public.products$q$ into n, m;
    execute $q$select count(*)::int from public.client_products$q$ into n2;
    reset role;
    agg := agg || u.id::text || ':' || m || ':' || n2 || ';';
    tot := tot + n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  r := r || jsonb_build_object('before_client_rls', jsonb_build_object('rows_total', tot, 'md5', md5(agg)));
  select jsonb_object_agg(p.proname, md5(pg_get_functiondef(p.oid))) into j from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname in ('place_direct_order','business_submit_rfq','convert_quotation_to_order','protect_catalogue_access');
  r := r || jsonb_build_object('before_fn_md5', j);
  select md5(string_agg(id::text||'@'||coalesce(updated_at::text,''), ',' order by id)) into m from public.products;
  r := r || jsonb_build_object('before_updated_at_md5', m);

  execute $mig$-- Per-channel product visibility: Retail store, Business portal, Corporate.
-- Apply after 20261021_pricing_engine.sql (and after 20261022_channel_order_visibility.sql
-- when that one is applied; if it is applied later, re-run this file: every step is
-- idempotent). Do not apply from the agent.
--
-- Before: the public store and the business portal showed only catalogue_access = 'all',
-- so "Selected companies" or "Not in client catalogues" also hid a product from retail.
-- After: products.show_in_store and products.show_in_business are independent switches.
-- catalogue_access keeps meaning corporate visibility only (/portal, client catalogues,
-- microsites, shared catalog links), with company_product_access and exclusions unchanged.
--
-- Backfill = current effective visibility: show_in_store = show_in_business =
-- (catalogue_access = 'all'). No product appears or disappears on any channel.
--
-- Function changes are text patches of the live definitions, so whichever body of
-- place_direct_order is live (pricing engine, or channel order visibility) is kept:
--   place_direct_order   store surface checks show_in_store, or show_in_business for
--                        source 'business', instead of catalogue_access = 'all'
--   business_submit_rfq  checks show_in_business instead of catalogue_access = 'all'
--   convert_quotation_to_order  a retail or business product with corporate 'none'
--                        can still be converted from a quotation
-- Each patch must match exactly once or the migration fails and nothing changes.


alter table public.products
  add column if not exists show_in_store boolean,
  add column if not exists show_in_business boolean;

-- Backfill only rows not set yet, without touching updated_at.
alter table public.products disable trigger products_updated_at;
update public.products
set show_in_store = coalesce(show_in_store, catalogue_access = 'all'),
    show_in_business = coalesce(show_in_business, catalogue_access = 'all')
where show_in_store is null or show_in_business is null;
alter table public.products enable trigger products_updated_at;

alter table public.products
  alter column show_in_store set default true,
  alter column show_in_store set not null,
  alter column show_in_business set default true,
  alter column show_in_business set not null;

comment on column public.products.show_in_store is
  'Retail store switch: public store, /catalogue, search, homepage. Independent of catalogue_access.';
comment on column public.products.show_in_business is
  'Business portal switch: /business for registered non-corporate businesses. Independent of catalogue_access.';
comment on column public.products.catalogue_access is
  'Corporate visibility only: all / selected / none for /portal, client catalogues and microsites.';

create index if not exists products_show_in_store_idx on public.products (status) where show_in_store;
create index if not exists products_show_in_business_idx on public.products (status) where show_in_business;

-- Only admin may change any channel switch (same rule as catalogue_access).
create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalogue_access is distinct from old.catalogue_access
    or new.visibility is distinct from old.visibility
    or new.show_in_store is distinct from old.show_in_store
    or new.show_in_business is distinct from old.show_in_business
  ) then
    if not public.is_admin() then
      raise exception 'Only admin can change product catalogue visibility';
    end if;
  end if;
  return new;
end;
$$;

-- Read policies. products_public_catalogue_select (active + 'all') is unchanged, so
-- corporate clients read exactly what they read today.
drop policy if exists products_store_select on public.products;
create policy products_store_select on public.products
  for select to anon
  using (status = 'active' and show_in_store);

drop policy if exists products_business_select on public.products;
create policy products_business_select on public.products
  for select to authenticated
  using (status = 'active' and show_in_business and public.is_business());

-- Text patches of live function bodies.
do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
  v_hits integer;
begin
  -- place_direct_order: store surface
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  v_old := $o$if v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$;
  v_new := $n$if v_product.status <> 'active' or not (
        case when v_source = 'business'
          then coalesce(v_product.show_in_business, v_product.catalogue_access = 'all')
          else coalesce(v_product.show_in_store, v_product.catalogue_access = 'all')
        end
      ) then$n$;
  if position('v_product.show_in_store' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'place_direct_order: expected 1 store check, found %', v_hits;
    end if;
    if position('v_source := p_source' in v_def) = 0
       or position('v_source := p_source' in v_def) > position(v_old in v_def) then
      raise exception 'place_direct_order: v_source is not set before the line checks';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- business_submit_rfq
  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  v_old := $o$if not found or v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$;
  v_new := $n$if not found or v_product.status <> 'active'
       or not coalesce(v_product.show_in_business, v_product.catalogue_access = 'all') then$n$;
  if position('v_product.show_in_business' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'business_submit_rfq: expected 1 check, found %', v_hits;
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- convert_quotation_to_order
  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);
  v_old := $o$coalesce(p.catalogue_access, 'all') <> 'none'$o$;
  v_new := $n$(coalesce(p.catalogue_access, 'all') <> 'none' or coalesce(p.show_in_store, false) or coalesce(p.show_in_business, false))$n$;
  if position('p.show_in_store' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 3 then
      raise exception 'convert_quotation_to_order: expected 3 checks, found %', v_hits;
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

$mig$;

  -- snapshot after
  execute format($q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products where status='active' and %s$q$, 'show_in_store') into j;
  r := r || jsonb_build_object('after_retail', j);
  execute format($q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products where status='active' and %s$q$, 'show_in_business') into j;
  r := r || jsonb_build_object('after_business', j);
  select jsonb_build_object('pairs',count(*),'companies',count(distinct c.id),'md5',md5(coalesce(string_agg(c.id::text||':'||p.id::text, ',' order by c.id, p.id),'')))
    into j
    from public.companies c cross join public.products p
   where p.status='active'
     and not exists (select 1 from public.company_product_exclusions e where e.company_id=c.id and e.product_id=p.id)
     and (p.catalogue_access='all' or (p.catalogue_access='selected' and exists (select 1 from public.company_product_access a where a.company_id=c.id and a.product_id=p.id)));
  r := r || jsonb_build_object('after_corporate_logic', j);
  set local role anon;
  execute $q$select jsonb_build_object('n',count(*),'md5',md5(coalesce(string_agg(id::text, ',' order by id),''))) from public.products$q$ into j;
  reset role;
  r := r || jsonb_build_object('after_anon_rls', j);
  agg := '';
  tot := 0;
  for u in select id from public.profiles where role in ('client_admin','client_user') and is_active order by id loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.id::text, true);
    set local role authenticated;
    execute $q$select count(*)::int, md5(coalesce(string_agg(id::text, ',' order by id),'')) from public.products$q$ into n, m;
    execute $q$select count(*)::int from public.client_products$q$ into n2;
    reset role;
    agg := agg || u.id::text || ':' || m || ':' || n2 || ';';
    tot := tot + n;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  r := r || jsonb_build_object('after_client_rls', jsonb_build_object('rows_total', tot, 'md5', md5(agg)));
  select jsonb_object_agg(p.proname, md5(pg_get_functiondef(p.oid))) into j from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname in ('place_direct_order','business_submit_rfq','convert_quotation_to_order','protect_catalogue_access');
  r := r || jsonb_build_object('after_fn_md5', j);
  select md5(string_agg(id::text||'@'||coalesce(updated_at::text,''), ',' order by id)) into m from public.products;
  r := r || jsonb_build_object('after_updated_at_md5', m);

  select jsonb_build_object(
    'store_on', count(*) filter (where show_in_store), 'business_on', count(*) filter (where show_in_business),
    'mismatch_vs_legacy', count(*) filter (where show_in_store <> (catalogue_access='all') or show_in_business <> (catalogue_access='all')),
    'rows', count(*)
  ) into j from public.products;
  r := r || jsonb_build_object('after_flags', j);
  r := r || jsonb_build_object('after_patched', jsonb_build_object(
    'place_direct_order', position('v_product.show_in_store' in pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure))>0,
    'business_submit_rfq', position('v_product.show_in_business' in pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure))>0,
    'convert_quotation_to_order', position('p.show_in_store' in pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure))>0));
  execute $rb$-- Rollback for 20261022_channel_visibility.sql.
-- Restores catalogue_access = 'all' as the store and business rule, then drops the
-- channel columns. Products whose Retail or Business switch was changed after the
-- migration go back to following corporate "All companies".


do $patch$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  v_def := replace(v_def, $n$if v_product.status <> 'active' or not (
        case when v_source = 'business'
          then coalesce(v_product.show_in_business, v_product.catalogue_access = 'all')
          else coalesce(v_product.show_in_store, v_product.catalogue_access = 'all')
        end
      ) then$n$, $o$if v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'place_direct_order still references the channel columns';
  end if;
  execute v_def;

  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  v_def := replace(v_def, $n$if not found or v_product.status <> 'active'
       or not coalesce(v_product.show_in_business, v_product.catalogue_access = 'all') then$n$,
    $o$if not found or v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'business_submit_rfq still references the channel columns';
  end if;
  execute v_def;

  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);
  v_def := replace(v_def,
    $n$(coalesce(p.catalogue_access, 'all') <> 'none' or coalesce(p.show_in_store, false) or coalesce(p.show_in_business, false))$n$,
    $o$coalesce(p.catalogue_access, 'all') <> 'none'$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'convert_quotation_to_order still references the channel columns';
  end if;
  execute v_def;
end;
$patch$;

drop policy if exists products_store_select on public.products;
drop policy if exists products_business_select on public.products;

-- Original body, verbatim.
create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.catalogue_access IS DISTINCT FROM OLD.catalogue_access
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
  ) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admin can change product catalogue visibility';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

comment on column public.products.catalogue_access is null;

drop index if exists public.products_show_in_store_idx;
drop index if exists public.products_show_in_business_idx;

alter table public.products
  drop column if exists show_in_store,
  drop column if exists show_in_business;

$rb$;
  select jsonb_object_agg(p.proname, md5(pg_get_functiondef(p.oid))) into j from pg_proc p join pg_namespace s on s.oid=p.pronamespace
   where s.nspname='public' and p.proname in ('place_direct_order','business_submit_rfq','convert_quotation_to_order','protect_catalogue_access');
  r := r || jsonb_build_object('after_rollback_fn_md5', j,
    'after_rollback_columns', (select count(*) from information_schema.columns where table_schema='public' and table_name='products' and column_name in ('show_in_store','show_in_business')));
  raise exception 'DRYRUN_RESULT %', r::text;
end
$dry$;