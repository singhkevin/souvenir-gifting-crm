-- Rollback for 20261027_samples_internal.sql.
-- Drops the holder ledger, the team-member column, and the sample-only visibility trigger.
-- Restores protect_catalogue_access to the 20261022 channel-visibility body.
-- Removes the sample_only exclusion from client catalogue views and from the public
-- product select policies this migration altered.
--
-- Staff-only policies on sample_stock and sample_movements are left in place.
-- The previous policies were not in the repo; dropping the staff policies would
-- either hide the register from the CRM or open it again. Sample stock stays internal.
-- Rows already marked sample-only stay off the public channels. Turn a product back
-- on from the product page after this rollback if it should be sold.

drop trigger if exists enforce_sample_only_internal on public.products;
drop function if exists public.enforce_sample_only_internal();

create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $protect$
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
$protect$;

do $views$
declare
  v_name text;
  v_def text;
begin
  foreach v_name in array array['client_products', 'portal_catalogue']
  loop
    if to_regclass('public.' || v_name) is null then
      continue;
    end if;
    v_def := pg_get_viewdef(format('public.%I', v_name)::regclass, true);
    v_def := regexp_replace(v_def, 'coalesce\(p\.sample_only,\s*false\)\s*=\s*false\s+and\s+', '', 'gi');
    v_def := regexp_replace(v_def, 'coalesce\(products\.sample_only,\s*false\)\s*=\s*false\s+and\s+', '', 'gi');
    if position('sample_only' in v_def) > 0 then
      raise exception 'public.% still mentions sample_only after rollback. Review the view before continuing.', v_name;
    end if;
    execute 'create or replace view public.' || quote_ident(v_name) || ' as ' || rtrim(v_def, E' \n\r;');
  end loop;
end
$views$;

do $product_policies$
declare
  r record;
  new_qual text;
begin
  for r in
    select pol.polname as policy_name,
           pg_get_expr(pol.polqual, pol.polrelid) as qual
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace nsp on nsp.oid = cls.relnamespace
    where nsp.nspname = 'public'
      and cls.relname = 'products'
      and pol.polcmd = 'r'
      and pol.polqual is not null
      and pg_get_expr(pol.polqual, pol.polrelid) ilike '%sample_only%'
  loop
    new_qual := regexp_replace(r.qual, '\s+and\s+\(?coalesce\(sample_only, false\) = false\)?', '', 'i');
    if position('sample_only' in new_qual) > 0 then
      raise exception 'policy % still mentions sample_only', r.policy_name;
    end if;
    execute 'alter policy ' || quote_ident(r.policy_name) || ' on public.products using (' || new_qual || ')';
  end loop;
end
$product_policies$;

drop table if exists public.sample_holder_balances;

alter table public.sample_movements drop column if exists holder_profile_id;
