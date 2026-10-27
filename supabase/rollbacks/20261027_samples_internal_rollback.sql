-- Rollback for 20261027_samples_internal.sql.
-- Removes the staff-only policies added by that file, the per-holder balance table,
-- and the sample_only filters on the two catalogue views and get_shared_catalog.
-- Older sample_stock / sample_movements policies are left in place (the forward
-- migration did not drop them). Anon grants are not restored.
-- Sample stock rows and receipt movements seeded for existing sample_only products
-- are kept: deleting them would drop a real office count. Remove those by hand
-- only if the seed was wrong (note = 'Initial sample receipt' and no later movement).

begin;

drop policy if exists products_sample_only_internal on public.products;

drop policy if exists sample_balances_staff_only on public.sample_balances;
drop policy if exists sample_balances_staff_rw on public.sample_balances;
drop table if exists public.sample_balances;

drop policy if exists sample_stock_staff_only on public.sample_stock;
drop policy if exists sample_stock_staff_rw on public.sample_stock;
drop policy if exists sample_movements_staff_only on public.sample_movements;
drop policy if exists sample_movements_staff_rw on public.sample_movements;

alter table public.sample_movements drop column if exists holder_profile_id;

do $views$
declare
  v_name text;
  v_def text;
  v_filter text := ' and coalesce(p.sample_only, false) = false';
begin
  foreach v_name in array array['client_products', 'portal_catalogue']
  loop
    if to_regclass('public.' || v_name) is null then
      continue;
    end if;
    v_def := pg_get_viewdef(format('public.%I', v_name)::regclass, true);
    if position('sample_only' in v_def) = 0 then
      continue;
    end if;
    v_def := replace(v_def, v_filter, '');
    v_def := rtrim(v_def);
    if right(v_def, 1) = ';' then
      v_def := left(v_def, length(v_def) - 1);
    end if;
    execute format('create or replace view public.%I as ', v_name) || v_def;
  end loop;
end
$views$;

do $catalog$
declare
  v_def text;
  v_filter text := ' and coalesce(p.sample_only, false) = false';
begin
  if to_regprocedure('public.get_shared_catalog(text)') is null then
    return;
  end if;
  v_def := pg_get_functiondef('public.get_shared_catalog(text)'::regprocedure);
  if position('sample_only' in v_def) = 0 then
    return;
  end if;
  execute replace(v_def, v_filter, '');
end
$catalog$;

commit;
