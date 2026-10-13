-- Case-insensitive unique category names, and an insert policy for admin and sales
-- only when RLS is already on and no insert policy mentions those roles.
-- Apply after 20261014_order_source.sql. Do not apply from the agent.
-- Duplicate names abort the migration and are listed in the exception.

begin;

do $$
declare
  dup text;
begin
  select string_agg(format('%s (%s)', name, n), ', ' order by name)
    into dup
  from (
    select lower(btrim(name)) as name, count(*) as n
    from public.categories
    group by lower(btrim(name))
    having count(*) > 1
  ) d;

  if dup is not null then
    raise exception 'categories name duplicates (lower(btrim(name))): %', dup;
  end if;

  raise notice 'categories unique index: no duplicate names';
end $$;

create unique index categories_name_ci
  on public.categories (lower(btrim(name)));

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'categories'
      and c.relrowsecurity
  ) then
    raise notice 'categories RLS is off; insert policy left unchanged';
    return;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and cmd = 'INSERT'
      and (
        coalesce(with_check, '') ilike '%admin%'
        or coalesce(with_check, '') ilike '%sales%'
        or coalesce(qual, '') ilike '%admin%'
        or coalesce(qual, '') ilike '%sales%'
      )
  ) then
    raise notice 'categories insert policy already allows admin or sales; left unchanged';
    return;
  end if;

  execute $pol$
    create policy categories_insert_staff
    on public.categories
    for insert
    to authenticated
    with check (public.has_any_role(array['admin', 'sales']::public.app_role[]))
  $pol$;
  raise notice 'created categories_insert_staff for admin and sales';
end $$;

commit;
