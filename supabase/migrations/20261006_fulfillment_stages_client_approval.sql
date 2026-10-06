-- Fulfillment stages + client approval gate.
-- Do not apply from the agent. Apply the whole file as one transaction after review.
--
-- Status mapping (orders.status and order_status_history from/to):
--   created            -> created          (Order received)
--   confirmed          -> created          (planning was not its own fulfillment stage)
--   in_progress        -> procurement      (it sat before procurement; do not jump to production)
--   procurement        -> procurement
--   printing           -> production       (branding already underway; do not pull it back through the new gate)
--   quality_check      -> packaging_qc
--   ready_to_dispatch  -> packaging_qc
--   dispatched         -> dispatched       (Dispatch)
--   delivered          -> delivered
--   cancelled          -> cancelled
-- New stages mockup and client_approval have no historical rows.
-- Original tokens are kept on order_status_history.note.
-- Mirrors LEGACY_ORDER_STATUS_MAP in src/lib/order-workflow.ts.
--
-- Gate: staff may enter production from client_approval only when
-- orders.client_approval_status = 'approved'. Portal client_decide_order_approval
-- records that decision. changes_requested moves the order back to mockup.

begin;

alter table public.orders
  add column if not exists client_approval_status text,
  add column if not exists client_approval_note text,
  add column if not exists client_approval_by uuid,
  add column if not exists client_approval_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_client_approval_by_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_client_approval_by_fkey
      foreign key (client_approval_by) references public.profiles (id);
  end if;
end $$;

alter table public.orders
  drop constraint if exists orders_client_approval_status_check;

alter table public.orders
  add constraint orders_client_approval_status_check
  check (
    client_approval_status is null
    or client_approval_status in ('approved', 'changes_requested')
  );

comment on column public.orders.client_approval_status is
  'Portal decision while the order is in client_approval: approved, changes_requested, or null while waiting. Cleared when the order re-enters client approval.';
comment on column public.orders.client_approval_note is
  'Optional note from the client approve / request-changes action.';
comment on column public.orders.client_approval_by is
  'Profile that recorded the latest client approval decision.';
comment on column public.orders.client_approval_at is
  'When the latest client approval decision was recorded.';

-- Remap helper. Dropped at the end of this migration.
create or replace function public.order_fulfillment_status_remap(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'confirmed' then 'created'
    when 'in_progress' then 'procurement'
    when 'printing' then 'production'
    when 'quality_check' then 'packaging_qc'
    when 'ready_to_dispatch' then 'packaging_qc'
    else p_status
  end
$$;

-- Drop status checks before converting an enum, so the check cannot block the type change.
do $$
declare
  r record;
begin
  for r in
    select n.nspname, c.relname, con.conname
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('orders', 'order_status_history')
      and con.contype = 'c'
      and con.conname <> 'orders_client_approval_status_check'
      and pg_get_constraintdef(con.oid) ~* 'created|confirmed|procurement|printing|delivered|quality_check|dispatched'
  loop
    execute format('alter table %I.%I drop constraint %I', r.nspname, r.relname, r.conname);
  end loop;
end $$;

-- New enum labels cannot be written in the same transaction that adds them.
-- When status is still a Postgres enum, convert the fulfillment columns to text
-- and constrain them below. Leave the old enum type in place so existing casts
-- keep compiling.
--
-- A view that reads those columns (public.portal_orders, plus any view built on
-- it) has to be dropped for the type change and then recreated from the catalog.
-- Recreation keeps the saved select list, column names, comments, owner,
-- reloptions, triggers, and grants. security_invoker is copied only when the
-- view has it today; a view without that option stays security definer.
-- Materialized views, extension-owned views, and views with extra rules are
-- not dropped. Casts to the converted enum type are removed from the saved
-- select so later labels (mockup, production, ...) still read.
do $enum$
declare
  r record;
  v_sql text;
  v_cols text;
  v_with text;
  v_blocked text;
  v_search_path text;
  v_enum text;
  v_enum_types text[] := '{}';
begin
  select coalesce(array_agg(distinct typname), '{}')
    into v_enum_types
  from (
    select format('%s.%s', quote_ident(tn.nspname), quote_ident(t.typname)) as typname
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    join pg_namespace tn on tn.oid = t.typnamespace
    where n.nspname = 'public'
      and c.relname in ('orders', 'order_status_history')
      and a.attname in ('status', 'from_status', 'to_status')
      and t.typtype = 'e'
      and not a.attisdropped
  ) types;

  if v_enum_types = '{}' then
    return;
  end if;

  create temp table _fulfillment_status_deps (
    obj_oid oid primary key,
    depth int not null
  ) on commit drop;

  insert into _fulfillment_status_deps (obj_oid, depth)
  with recursive tree as (
    select distinct c.oid as obj_oid, 0 as depth, array[c.oid] as path
    from pg_depend d
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class c on c.oid = rw.ev_class
    join pg_attribute a on a.attrelid = d.refobjid and a.attnum = d.refobjsubid
    join pg_type t on t.oid = a.atttypid
    where d.classid = 'pg_rewrite'::regclass
      and t.typtype = 'e'
      and d.refobjid in ('public.orders'::regclass, 'public.order_status_history'::regclass)
      and a.attname in ('status', 'from_status', 'to_status')
      and not a.attisdropped
      and c.oid <> d.refobjid
    union all
    select c.oid, tree.depth + 1, tree.path || c.oid
    from tree
    join pg_depend d on d.refobjid = tree.obj_oid and d.classid = 'pg_rewrite'::regclass
    join pg_rewrite rw on rw.oid = d.objid
    join pg_class c on c.oid = rw.ev_class
    where tree.depth < 64
      and c.oid <> all (tree.path)
  )
  select obj_oid, max(depth)
  from tree
  group by obj_oid;

  if exists (select 1 from _fulfillment_status_deps where depth >= 64) then
    raise exception 'Order status view dependency chain is too deep to recreate safely';
  end if;

  select string_agg(label, ', ' order by label)
    into v_blocked
  from (
    select format('%I.%I', n.nspname, c.relname) ||
      case
        when e.extname is not null then format(' (extension %I)', e.extname)
        when c.relkind = 'm' then ' (materialized view)'
        when exists (
          select 1
          from pg_rewrite rw
          where rw.ev_class = c.oid
            and rw.rulename <> '_RETURN'
        ) then ' (extra rules)'
        else format(' (relkind %s)', c.relkind)
      end as label
    from _fulfillment_status_deps d
    join pg_class c on c.oid = d.obj_oid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_depend ed
      on ed.classid = 'pg_class'::regclass
     and ed.objid = c.oid
     and ed.deptype = 'e'
    left join pg_extension e on e.oid = ed.refobjid
    where c.relkind <> 'v'
       or e.oid is not null
       or exists (
         select 1
         from pg_rewrite rw
         where rw.ev_class = c.oid
           and rw.rulename <> '_RETURN'
       )
  ) blocked;

  if v_blocked is not null then
    raise exception
      'Order status columns are enums used by relations this migration will not recreate (%).',
      v_blocked;
  end if;

  create temp table _fulfillment_status_views (
    view_oid oid primary key,
    nspname name not null,
    relname name not null,
    depth int not null,
    definition text not null,
    col_names text[] not null,
    col_comments text[] not null,
    reloptions text[],
    owner_name name not null,
    view_comment text,
    acl_explicit boolean not null,
    grants text[] not null,
    triggers text[] not null
  ) on commit drop;

  v_search_path := current_setting('search_path');
  perform set_config('search_path', '', true);
  begin
    insert into _fulfillment_status_views
    select
      c.oid,
      n.nspname,
      c.relname,
      d.depth,
      pg_get_viewdef(c.oid, true),
      cols.names,
      cols.comments,
      c.reloptions,
      pg_get_userbyid(c.relowner),
      obj_description(c.oid, 'pg_class'),
      c.relacl is not null,
      coalesce(table_grants.sql, '{}'::text[]) || coalesce(column_grants.sql, '{}'::text[]),
      coalesce(trigger_defs.sql, '{}'::text[])
    from _fulfillment_status_deps d
    join pg_class c on c.oid = d.obj_oid
    join pg_namespace n on n.oid = c.relnamespace
    join lateral (
      select
        coalesce(array_agg(a.attname::text order by a.attnum), '{}') as names,
        coalesce(array_agg(col_description(a.attrelid, a.attnum) order by a.attnum), '{}') as comments
      from pg_attribute a
      where a.attrelid = c.oid
        and a.attnum > 0
        and not a.attisdropped
    ) cols on true
    left join lateral (
      select array_agg(
        format(
          'grant %s on table %I.%I to %s%s',
          x.privilege_type,
          n.nspname,
          c.relname,
          case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end,
          case when x.is_grantable then ' with grant option' else '' end
        )
        order by x.grantee, x.privilege_type
      ) as sql
      from aclexplode(c.relacl) as x
    ) table_grants on true
    left join lateral (
      select array_agg(
        format(
          'grant %s (%I) on table %I.%I to %s%s',
          x.privilege_type,
          a.attname,
          n.nspname,
          c.relname,
          case when x.grantee = 0 then 'public' else quote_ident(pg_get_userbyid(x.grantee)) end,
          case when x.is_grantable then ' with grant option' else '' end
        )
        order by a.attnum, x.grantee, x.privilege_type
      ) as sql
      from pg_attribute a
      cross join lateral aclexplode(a.attacl) as x
      where a.attrelid = c.oid
        and a.attacl is not null
    ) column_grants on true
    left join lateral (
      select array_agg(pg_get_triggerdef(t.oid, true) order by t.tgname) as sql
      from pg_trigger t
      where t.tgrelid = c.oid
        and not t.tgisinternal
    ) trigger_defs on true
    where c.relkind = 'v';

    perform set_config('search_path', v_search_path, true);
  exception
    when others then
      perform set_config('search_path', v_search_path, true);
      raise;
  end;

  foreach v_enum in array v_enum_types loop
    update _fulfillment_status_views
    set definition = regexp_replace(
      definition,
      '::' || replace(v_enum, '.', '\.') || '\M',
      '',
      'g'
    );
  end loop;

  for r in
    select nspname, relname
    from _fulfillment_status_views
    order by depth desc, nspname, relname
  loop
    execute format('drop view %I.%I', r.nspname, r.relname);
  end loop;

  for r in
    select n.nspname, c.relname, a.attname,
           case when ad.adbin is null then null else pg_get_expr(ad.adbin, ad.adrelid) end as defexpr
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where n.nspname = 'public'
      and c.relname in ('orders', 'order_status_history')
      and a.attname in ('status', 'from_status', 'to_status')
      and t.typtype = 'e'
      and not a.attisdropped
  loop
    if r.defexpr is not null then
      execute format(
        'alter table %I.%I alter column %I drop default',
        r.nspname, r.relname, r.attname
      );
    end if;
    execute format(
      'alter table %I.%I alter column %I type text using %I::text',
      r.nspname, r.relname, r.attname, r.attname
    );
    if r.relname = 'orders' and r.attname = 'status' and r.defexpr is not null then
      execute 'alter table public.orders alter column status set default ''created''';
    end if;
  end loop;

  for r in
    select *
    from _fulfillment_status_views
    order by depth asc, nspname, relname
  loop
    select string_agg(quote_ident(col), ', ' order by ord)
      into v_cols
    from unnest(r.col_names) with ordinality as u(col, ord);

    if v_cols is null or v_cols = '' then
      raise exception 'View %.% has no columns to recreate', r.nspname, r.relname;
    end if;

    v_with := '';
    if r.reloptions is not null then
      v_with := ' with (' || array_to_string(r.reloptions, ', ') || ')';
    end if;

    -- Concatenate the select list. format() would treat "%" in the view body as a placeholder.
    execute format('create view %I.%I (%s)%s as ', r.nspname, r.relname, v_cols, v_with)
      || r.definition;

    if r.view_comment is not null then
      execute format('comment on view %I.%I is %L', r.nspname, r.relname, r.view_comment);
    end if;

    for v_sql in
      select format('comment on column %I.%I.%I is %L', r.nspname, r.relname, u.col, u.comment)
      from unnest(r.col_names, r.col_comments) as u(col, comment)
      where u.comment is not null
    loop
      execute v_sql;
    end loop;

    if r.triggers is not null then
      foreach v_sql in array r.triggers loop
        execute v_sql;
      end loop;
    end if;

    execute format('alter view %I.%I owner to %I', r.nspname, r.relname, r.owner_name);

    if r.acl_explicit then
      execute format('revoke all on table %I.%I from public', r.nspname, r.relname);
      execute format('revoke all on table %I.%I from %I', r.nspname, r.relname, r.owner_name);
    end if;

    if r.grants is not null then
      foreach v_sql in array r.grants loop
        execute v_sql;
      end loop;
    end if;

    raise notice 'Recreated %.% after converting order status columns to text', r.nspname, r.relname;
  end loop;
end
$enum$;

do $$
begin
  if exists (
    select 1
    from (values ('order_id'), ('from_status'), ('to_status'), ('changed_by'), ('note'), ('changed_at')) as needed(col)
    where not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'order_status_history'
        and column_name = needed.col
    )
  ) then
    raise exception 'order_status_history is missing note, changed_at, changed_by, from_status, or to_status';
  end if;
end $$;

alter table public.orders disable trigger user;
alter table public.order_status_history disable trigger user;

update public.order_status_history as h
set
  note = concat_ws(
    ' ',
    nullif(h.note, ''),
    case
      when h.from_status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch')
        then '[remapped from ' || h.from_status || ']'
      else null
    end,
    case
      when h.to_status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch')
       and h.to_status is distinct from h.from_status
        then '[remapped from ' || h.to_status || ']'
      else null
    end
  ),
  from_status = public.order_fulfillment_status_remap(h.from_status),
  to_status = public.order_fulfillment_status_remap(h.to_status)
where h.from_status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch')
   or h.to_status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch');

insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
select
  o.id,
  public.order_fulfillment_status_remap(o.status),
  public.order_fulfillment_status_remap(o.status),
  p.id,
  'Stage renamed from ' || o.status || ' to ' || public.order_fulfillment_status_remap(o.status),
  now()
from public.orders o
join public.profiles p on p.id = coalesce(o.owner_id, o.assigned_to)
where o.status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch');

update public.orders
set status = public.order_fulfillment_status_remap(status)
where status in ('confirmed', 'in_progress', 'printing', 'quality_check', 'ready_to_dispatch');

do $$
declare
  v_bad text;
begin
  select string_agg(distinct status, ', ' order by status)
    into v_bad
  from (
    select status from public.orders
    union all
    select from_status from public.order_status_history
    union all
    select to_status from public.order_status_history
  ) as statuses
  where status is not null
    and status not in (
      'created', 'procurement', 'mockup', 'client_approval', 'production',
      'packaging_qc', 'dispatched', 'delivered', 'cancelled'
    );

  if v_bad is not null then
    raise exception 'Unmapped order status values remain: %', v_bad;
  end if;
end $$;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (
    status in (
      'created', 'procurement', 'mockup', 'client_approval', 'production',
      'packaging_qc', 'dispatched', 'delivered', 'cancelled'
    )
  );

alter table public.order_status_history
  drop constraint if exists order_status_history_from_status_check;

alter table public.order_status_history
  add constraint order_status_history_from_status_check
  check (
    from_status is null
    or from_status in (
      'created', 'procurement', 'mockup', 'client_approval', 'production',
      'packaging_qc', 'dispatched', 'delivered', 'cancelled'
    )
  );

alter table public.order_status_history
  drop constraint if exists order_status_history_to_status_check;

alter table public.order_status_history
  add constraint order_status_history_to_status_check
  check (
    to_status is null
    or to_status in (
      'created', 'procurement', 'mockup', 'client_approval', 'production',
      'packaging_qc', 'dispatched', 'delivered', 'cancelled'
    )
  );

alter table public.orders enable trigger user;
alter table public.order_status_history enable trigger user;

-- Stage history is written by advance_order_stage / client_decide_order_approval.
-- A second trigger that also inserts order_status_history would duplicate rows.
do $$
declare
  r record;
begin
  for r in
    select tg.tgname
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    where tg.tgrelid = 'public.orders'::regclass
      and not tg.tgisinternal
      and p.prosrc ilike '%order_status_history%'
  loop
    execute format('drop trigger if exists %I on public.orders', r.tgname);
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('advance_order_stage', 'client_decide_order_approval')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

create function public.advance_order_stage(
  p_order_id uuid,
  p_status text,
  p_assigned_to uuid default null,
  p_department_id uuid default null,
  p_comment text default null,
  p_stage_due text default null,
  p_next_action text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_role text;
  v_next text;
  v_due date;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_role
  from public.profiles
  where id = auth.uid();

  if v_role is null or v_role not in ('admin', 'operations') then
    raise exception 'Not permitted to change order stages';
  end if;

  if p_status is null or btrim(p_status) = '' then
    raise exception 'Stage is required';
  end if;

  if p_status not in (
    'created', 'procurement', 'mockup', 'client_approval', 'production',
    'packaging_qc', 'dispatched', 'delivered', 'cancelled'
  ) then
    raise exception 'Invalid stage';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if p_stage_due is not null and btrim(p_stage_due) <> '' then
    v_due := btrim(p_stage_due)::date;
  end if;

  if p_status is distinct from v_order.status then
    if v_order.status in ('delivered', 'cancelled') then
      raise exception 'This stage is terminal';
    end if;

    if p_status = 'cancelled' then
      null;
    elsif v_order.status = 'client_approval' and p_status = 'mockup' then
      null;
    else
      v_next := case v_order.status
        when 'created' then 'procurement'
        when 'procurement' then 'mockup'
        when 'mockup' then 'client_approval'
        when 'client_approval' then 'production'
        when 'production' then 'packaging_qc'
        when 'packaging_qc' then 'dispatched'
        when 'dispatched' then 'delivered'
        else null
      end;

      if p_status is distinct from v_next then
        raise exception 'Move one stage at a time';
      end if;

      if v_order.status = 'client_approval'
         and p_status = 'production'
         and v_order.client_approval_status is distinct from 'approved' then
        raise exception 'Client approval is required before production';
      end if;
    end if;
  end if;

  update public.orders
  set
    status = p_status,
    assigned_to = coalesce(p_assigned_to, assigned_to),
    current_department_id = coalesce(p_department_id, current_department_id),
    next_action = coalesce(nullif(btrim(p_next_action), ''), next_action),
    client_approval_status = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then 'changes_requested'
      else client_approval_status
    end,
    client_approval_note = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then coalesce(nullif(btrim(p_comment), ''), client_approval_note)
      else client_approval_note
    end,
    client_approval_by = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then auth.uid()
      else client_approval_by
    end,
    client_approval_at = case
      when p_status = 'client_approval' and v_order.status is distinct from 'client_approval' then null
      when v_order.status = 'client_approval' and p_status = 'mockup' then now()
      else client_approval_at
    end,
    updated_at = now()
  where id = p_order_id;

  if v_due is not null then
    update public.orders
    set stage_due_at = v_due
    where id = p_order_id;
  end if;

  if p_assigned_to is not null or p_department_id is not null then
    insert into public.order_assignments (order_id, department_id, assigned_to, assigned_by, note)
    values (
      p_order_id,
      coalesce(p_department_id, v_order.current_department_id),
      p_assigned_to,
      auth.uid(),
      nullif(btrim(p_comment), '')
    );
  end if;

  if p_status is distinct from v_order.status or nullif(btrim(p_comment), '') is not null then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (
      p_order_id,
      v_order.status,
      p_status,
      auth.uid(),
      nullif(btrim(p_comment), ''),
      now()
    );
  end if;
end;
$$;

comment on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) is
  'Staff stage change. One step forward, cancel, or client_approval back to mockup. Production requires client_approval_status = approved. Null assignee, department, due, and next action keep the current values.';

create function public.client_decide_order_approval(
  p_order_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order public.orders%rowtype;
  v_note text;
  v_dept uuid;
  v_manager uuid;
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;

  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Invalid approval decision';
  end if;

  v_note := left(nullif(btrim(coalesce(p_note, '')), ''), 2000);

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.company_id is distinct from public.client_company_id() then
    raise exception 'Not permitted to approve this order';
  end if;

  if v_order.status is distinct from 'client_approval' then
    raise exception 'This order is not waiting for client approval';
  end if;

  if p_decision = 'approved' then
    update public.orders
    set
      client_approval_status = 'approved',
      client_approval_note = v_note,
      client_approval_by = auth.uid(),
      client_approval_at = now(),
      updated_at = now()
    where id = p_order_id;

    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
    values (
      p_order_id,
      'client_approval',
      'client_approval',
      auth.uid(),
      concat_ws(' ', 'Client approved.', v_note),
      now()
    );

    perform public.notify_users(
      'internal',
      v_order.company_id,
      'Client approved the mockup',
      coalesce(v_note, ''),
      '/crm/orders/' || p_order_id::text
    );
    return;
  end if;

  select id, manager_id
    into v_dept, v_manager
  from public.departments
  where slug = 'printing'
  limit 1;

  update public.orders
  set
    status = 'mockup',
    client_approval_status = 'changes_requested',
    client_approval_note = v_note,
    client_approval_by = auth.uid(),
    client_approval_at = now(),
    current_department_id = coalesce(v_dept, current_department_id),
    assigned_to = coalesce(v_manager, assigned_to),
    updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note, changed_at)
  values (
    p_order_id,
    'client_approval',
    'mockup',
    auth.uid(),
    concat_ws(' ', 'Changes requested.', v_note),
    now()
  );

  if v_dept is not null or v_manager is not null then
    insert into public.order_assignments (order_id, department_id, assigned_to, assigned_by, note)
    values (p_order_id, v_dept, v_manager, auth.uid(), concat_ws(' ', 'Changes requested.', v_note));
  end if;

  perform public.notify_users(
    'internal',
    v_order.company_id,
    'Client requested mockup changes',
    coalesce(v_note, ''),
    '/crm/orders/' || p_order_id::text
  );
end;
$$;

comment on function public.client_decide_order_approval(uuid, text, text) is
  'Portal approve stays on client_approval and unlocks production. Request changes returns the order to mockup.';

revoke all on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) from public;
revoke all on function public.client_decide_order_approval(uuid, text, text) from public;
grant execute on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) to authenticated;
grant execute on function public.client_decide_order_approval(uuid, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) to service_role';
    execute 'grant execute on function public.client_decide_order_approval(uuid, text, text) to service_role';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function public.advance_order_stage(uuid, text, uuid, uuid, text, text, text) from anon';
    execute 'revoke all on function public.client_decide_order_approval(uuid, text, text) from anon';
  end if;
end $$;

drop function if exists public.order_fulfillment_status_remap(text);

-- Direct table updates from the API roles cannot flip the approval flag.
-- The stage RPCs are security definer and run as the function owner, so they still can.
create or replace function public.guard_order_client_approval()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (
       new.client_approval_status is distinct from old.client_approval_status
       or new.client_approval_note is distinct from old.client_approval_note
       or new.client_approval_by is distinct from old.client_approval_by
       or new.client_approval_at is distinct from old.client_approval_at
     )
  then
    raise exception 'Client approval is recorded by the portal approval action';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_client_approval on public.orders;
create trigger orders_guard_client_approval
  before update on public.orders
  for each row
  execute function public.guard_order_client_approval();

notify pgrst, 'reload schema';

commit;
