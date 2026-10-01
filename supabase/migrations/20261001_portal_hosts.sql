-- Phase 2: portal_hosts queue + claim RPC + companies triggers for Hostinger parked domains.
-- Idempotent. Do not apply via agent; owner applies manually.
begin;

-- ---------------------------------------------------------------------------
-- 1. portal_hosts
-- ---------------------------------------------------------------------------
create table if not exists public.portal_hosts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  slug text not null,
  hostname text not null,
  role text not null default 'primary',
  desired text not null default 'parked',
  status text not null default 'queued',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  verify_deadline timestamptz,
  redirect_until timestamptz,
  unpark_after timestamptz,
  action_requested_at timestamptz,
  park_requests integer not null default 0,
  unpark_requests integer not null default 0,
  unpark_requested_at timestamptz,
  last_error text,
  last_error_code text,
  last_checked_at timestamptz,
  live_at timestamptz,
  notify_on_live boolean not null default true,
  notify_client_admins boolean not null default false,
  notified_live_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portal_hosts_role_check check (role in ('primary', 'redirect', 'manual')),
  constraint portal_hosts_desired_check check (desired in ('parked', 'unparked')),
  constraint portal_hosts_status_check check (
    status in (
      'queued', 'parking', 'verifying', 'live',
      'unparking', 'removed', 'failed', 'blocked'
    )
  ),
  constraint portal_hosts_slug_format_check check (
    char_length(slug) between 3 and 40
    and slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'
  )
);

alter table public.portal_hosts
  add column if not exists action_requested_at timestamptz;

alter table public.portal_hosts
  add column if not exists park_requests integer;

update public.portal_hosts
set park_requests = 0
where park_requests is null;

alter table public.portal_hosts
  alter column park_requests set default 0;

alter table public.portal_hosts
  alter column park_requests set not null;

alter table public.portal_hosts
  add column if not exists unpark_requests integer;

update public.portal_hosts
set unpark_requests = 0
where unpark_requests is null;

alter table public.portal_hosts
  alter column unpark_requests set default 0;

alter table public.portal_hosts
  alter column unpark_requests set not null;

alter table public.portal_hosts
  add column if not exists unpark_requested_at timestamptz;

alter table public.portal_hosts
  add column if not exists notify_client_admins boolean;

update public.portal_hosts
set notify_client_admins = false
where notify_client_admins is null;

alter table public.portal_hosts
  alter column notify_client_admins set default false;

alter table public.portal_hosts
  alter column notify_client_admins set not null;

alter table public.portal_hosts drop constraint if exists portal_hosts_hostname_matches_slug;
alter table public.portal_hosts
  add constraint portal_hosts_hostname_matches_slug
  check (hostname = slug || '.giftingstore.online');

create unique index if not exists portal_hosts_hostname_active_key
  on public.portal_hosts (hostname)
  where status <> 'removed';

create unique index if not exists portal_hosts_one_primary_parked_per_company
  on public.portal_hosts (company_id)
  where role = 'primary' and desired = 'parked' and status <> 'removed';

create index if not exists portal_hosts_claim_idx
  on public.portal_hosts (next_attempt_at, status)
  where status <> 'removed';

create index if not exists portal_hosts_company_idx
  on public.portal_hosts (company_id);

create index if not exists portal_hosts_slug_idx
  on public.portal_hosts (slug);

comment on table public.portal_hosts is
  'Hostinger parked-domain provisioning queue. One row per hostname (active until removed).';

-- ---------------------------------------------------------------------------
-- 2. portal_host_runs
-- ---------------------------------------------------------------------------
create table if not exists public.portal_host_runs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed integer not null default 0,
  errors integer not null default 0,
  rate_limited_until timestamptz,
  details jsonb not null default '{}'::jsonb,
  constraint portal_host_runs_kind_check check (kind in ('worker', 'reconcile'))
);

create index if not exists portal_host_runs_started_idx
  on public.portal_host_runs (started_at desc);

comment on table public.portal_host_runs is
  'Worker/reconcile run log for portal host provisioning.';

revoke all on table public.portal_hosts from anon;
revoke all on table public.portal_host_runs from anon;
revoke insert, update, delete, truncate on table public.portal_hosts from authenticated;
revoke insert, update, delete, truncate on table public.portal_host_runs from authenticated;

-- ---------------------------------------------------------------------------
-- 3. RLS — staff SELECT only; writes via service role / security definer
-- ---------------------------------------------------------------------------
alter table public.portal_hosts enable row level security;
alter table public.portal_host_runs enable row level security;

drop policy if exists portal_hosts_select on public.portal_hosts;
create policy portal_hosts_select on public.portal_hosts
  for select using (
    public.is_admin()
    or public.can_crm()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'sales'
    )
  );

drop policy if exists portal_host_runs_select on public.portal_host_runs;
create policy portal_host_runs_select on public.portal_host_runs
  for select using (
    public.is_admin()
    or public.can_crm()
  );

-- ---------------------------------------------------------------------------
-- 4. updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.portal_hosts_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portal_hosts_touch_updated_at on public.portal_hosts;
create trigger portal_hosts_touch_updated_at
  before update on public.portal_hosts
  for each row
  execute function public.portal_hosts_touch_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Root domain helper
-- ---------------------------------------------------------------------------
create or replace function public.portal_host_hostname(p_slug text)
returns text
language sql
immutable
as $$
  select lower(p_slug) || '.giftingstore.online';
$$;

-- ---------------------------------------------------------------------------
-- 6. Cool-off / conflict check
-- ---------------------------------------------------------------------------
create or replace function public.portal_hosts_assert_slug_available(
  p_slug text,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hostname text := public.portal_host_hostname(p_slug);
  v_other record;
begin
  select ph.* into v_other
  from public.portal_hosts ph
  where ph.hostname = v_hostname
    and ph.status <> 'removed'
    and (ph.company_id is distinct from p_company_id)
  limit 1;

  if found then
    raise exception 'PORTAL_SLUG_HELD: That portal address is already assigned to another company.'
      using errcode = 'P0001';
  end if;

  select ph.* into v_other
  from public.portal_hosts ph
  where ph.hostname = v_hostname
    and ph.status = 'removed'
    and ph.updated_at > now() - interval '90 days'
    and (ph.company_id is distinct from p_company_id)
  limit 1;

  if found then
    raise exception 'PORTAL_SLUG_COOLOFF: That portal address was recently used and cannot be reused yet.'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.portal_hosts_assert_slug_available(text, uuid) from public, anon, authenticated;
grant execute on function public.portal_hosts_assert_slug_available(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Trigger: queue park / redirect / unpark on portal_slug / portal_status
-- ---------------------------------------------------------------------------
create or replace function public.companies_sync_portal_hosts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_slug text;
  v_new_slug text;
  v_old_host text;
  v_new_host text;
  v_existing_id uuid;
  v_existing_status text;
  v_want_unparked boolean;
  v_has_primary_parked boolean;
begin
  v_old_slug := case when tg_op = 'UPDATE' then old.portal_slug else null end;
  v_new_slug := new.portal_slug;
  v_want_unparked := (new.portal_status = 'cancelled');

  if v_new_slug is not null
     and (tg_op = 'INSERT' or v_new_slug is distinct from v_old_slug) then
    perform public.portal_hosts_assert_slug_available(v_new_slug, new.id);
  end if;

  -- New / changed slug → primary row
  if v_new_slug is not null
     and (tg_op = 'INSERT' or v_new_slug is distinct from v_old_slug) then
    v_new_host := public.portal_host_hostname(v_new_slug);

    -- Demote previous primary to redirect (stay parked 30 days)
    if v_old_slug is not null and v_old_slug is distinct from v_new_slug then
      v_old_host := public.portal_host_hostname(v_old_slug);
      update public.portal_hosts
      set role = 'redirect',
          desired = 'parked',
          redirect_until = now() + interval '30 days',
          unpark_after = null,
          next_attempt_at = now() + interval '30 days',
          last_error = null,
          last_error_code = null
      where company_id = new.id
        and hostname = v_old_host
        and status <> 'removed'
        and role = 'primary';
    end if;

    select id, status into v_existing_id, v_existing_status
    from public.portal_hosts
    where hostname = v_new_host
      and status <> 'removed'
    limit 1;

    if v_existing_id is not null then
      if v_want_unparked then
        update public.portal_hosts
        set company_id = new.id,
            slug = v_new_slug,
            role = 'primary',
            desired = 'unparked',
            unpark_after = now() + interval '30 days',
            next_attempt_at = now() + interval '30 days',
            redirect_until = null,
            locked_until = null,
            unpark_requests = 0,
            unpark_requested_at = null,
            status = case when status = 'live' then status else status end,
            last_error = case when status = 'live' then last_error else last_error end
        where id = v_existing_id;
      elsif v_existing_status = 'live' then
        update public.portal_hosts
        set company_id = new.id,
            slug = v_new_slug,
            role = 'primary',
            desired = 'parked',
            redirect_until = null,
            unpark_after = null,
            locked_until = null
        where id = v_existing_id;
      else
        update public.portal_hosts
        set company_id = new.id,
            slug = v_new_slug,
            role = 'primary',
            desired = 'parked',
            status = 'queued',
            attempts = 0,
            park_requests = 0,
            action_requested_at = null,
            unpark_requests = 0,
            unpark_requested_at = null,
            verify_deadline = null,
            next_attempt_at = now(),
            redirect_until = null,
            unpark_after = null,
            locked_until = null,
            last_error = null,
            last_error_code = null,
            notify_on_live = true
        where id = v_existing_id;
      end if;
    else
      if v_want_unparked then
        insert into public.portal_hosts (
          company_id, slug, hostname, role, desired, status,
          attempts, next_attempt_at, unpark_after, unpark_requests, notify_on_live
        ) values (
          new.id, v_new_slug, v_new_host, 'primary', 'unparked', 'queued',
          0, now() + interval '30 days', now() + interval '30 days', 0, true
        );
      else
        insert into public.portal_hosts (
          company_id, slug, hostname, role, desired, status,
          attempts, next_attempt_at, notify_on_live
        ) values (
          new.id, v_new_slug, v_new_host, 'primary', 'parked', 'queued',
          0, now(), true
        );
      end if;
    end if;

    update public.companies
    set subdomain_status = case
          when subdomain_status = 'live' and v_old_slug is not distinct from v_new_slug then subdomain_status
          else 'pending'
        end,
        subdomain_updated_at = now(),
        subdomain_last_error = null
    where id = new.id
      and (subdomain_status is distinct from 'live' or v_old_slug is distinct from v_new_slug);
  end if;

  -- Slug cleared → schedule unpark of old primary after 7 days
  if v_new_slug is null
     and v_old_slug is not null then
    v_old_host := public.portal_host_hostname(v_old_slug);
    update public.portal_hosts
    set desired = 'unparked',
        unpark_after = now() + interval '7 days',
        next_attempt_at = now() + interval '7 days',
        redirect_until = null,
        unpark_requests = 0,
        unpark_requested_at = null
    where company_id = new.id
      and hostname = v_old_host
      and status <> 'removed';

    update public.companies
    set subdomain_status = 'none',
        subdomain_updated_at = now(),
        subdomain_last_error = null
    where id = new.id;
  end if;

  -- Cancelled → unpark primary + redirect after 30 days
  if tg_op = 'UPDATE'
     and new.portal_status is distinct from old.portal_status
     and new.portal_status = 'cancelled' then
    update public.portal_hosts
    set desired = 'unparked',
        unpark_after = least(coalesce(unpark_after, now() + interval '30 days'), now() + interval '30 days'),
        next_attempt_at = least(coalesce(next_attempt_at, now() + interval '30 days'), now() + interval '30 days'),
        unpark_requests = 0,
        unpark_requested_at = null
    where company_id = new.id
      and status <> 'removed'
      and desired = 'parked';
  end if;

  -- Leaving cancelled → restore park for current primary + active redirects
  if tg_op = 'UPDATE'
     and old.portal_status = 'cancelled'
     and new.portal_status is distinct from 'cancelled'
     and new.portal_slug is not null then
    v_new_host := public.portal_host_hostname(new.portal_slug);

    select exists (
      select 1 from public.portal_hosts ph
      where ph.company_id = new.id
        and ph.role = 'primary'
        and ph.desired = 'parked'
        and ph.status <> 'removed'
    ) into v_has_primary_parked;

    -- Non-removed primary for current hostname
    update public.portal_hosts
    set desired = 'parked',
        unpark_after = null,
        next_attempt_at = now(),
        attempts = case when status in ('unparking', 'failed') then 0 else attempts end,
        park_requests = case when status in ('unparking', 'failed') then 0 else park_requests end,
        action_requested_at = case when status in ('unparking', 'failed') then null else action_requested_at end,
        unpark_requests = case when status in ('unparking', 'failed') then 0 else unpark_requests end,
        unpark_requested_at = case when status in ('unparking', 'failed') then null else unpark_requested_at end,
        verify_deadline = case when status in ('unparking', 'failed') then null else verify_deadline end,
        status = case
          when status in ('unparking', 'failed') then 'queued'
          else status
        end,
        last_error = case
          when status in ('unparking', 'failed') then null
          else last_error
        end,
        last_error_code = case
          when status in ('unparking', 'failed') then null
          else last_error_code
        end
    where company_id = new.id
      and hostname = v_new_host
      and role = 'primary'
      and status <> 'removed';

    -- Latest removed primary for hostname only if no other non-removed row holds it,
    -- and only if this company does not already have a primary/parked row.
    if not v_has_primary_parked
       and not exists (
         select 1 from public.portal_hosts ph
         where ph.hostname = v_new_host and ph.status <> 'removed'
       ) then
      update public.portal_hosts ph
      set desired = 'parked',
          unpark_after = null,
          next_attempt_at = now(),
          attempts = 0,
          park_requests = 0,
          action_requested_at = null,
          unpark_requests = 0,
          unpark_requested_at = null,
          verify_deadline = null,
          status = 'queued',
          last_error = null,
          last_error_code = null,
          role = 'primary',
          company_id = new.id,
          slug = new.portal_slug
      where ph.id = (
        select ph2.id
        from public.portal_hosts ph2
        where ph2.company_id = new.id
          and ph2.hostname = v_new_host
          and ph2.role = 'primary'
          and ph2.status = 'removed'
        order by ph2.updated_at desc
        limit 1
      );
    end if;

    -- Non-removed redirects still in grace
    update public.portal_hosts
    set desired = 'parked',
        unpark_after = null,
        next_attempt_at = now(),
        attempts = case when status in ('unparking', 'failed') then 0 else attempts end,
        park_requests = case when status in ('unparking', 'failed') then 0 else park_requests end,
        action_requested_at = case when status in ('unparking', 'failed') then null else action_requested_at end,
        unpark_requests = case when status in ('unparking', 'failed') then 0 else unpark_requests end,
        unpark_requested_at = case when status in ('unparking', 'failed') then null else unpark_requested_at end,
        verify_deadline = case when status in ('unparking', 'failed') then null else verify_deadline end,
        status = case
          when status in ('unparking', 'failed') then 'queued'
          else status
        end,
        last_error = case
          when status in ('unparking', 'failed') then null
          else last_error
        end,
        last_error_code = case
          when status in ('unparking', 'failed') then null
          else last_error_code
        end
    where company_id = new.id
      and role = 'redirect'
      and redirect_until is not null
      and redirect_until > now()
      and status <> 'removed';

    -- Latest removed redirect per hostname (only if hostname free)
    update public.portal_hosts ph
    set desired = 'parked',
        unpark_after = null,
        next_attempt_at = now(),
        attempts = 0,
        park_requests = 0,
        action_requested_at = null,
        unpark_requests = 0,
        unpark_requested_at = null,
        verify_deadline = null,
        status = 'queued',
        last_error = null,
        last_error_code = null
    where ph.id in (
      select distinct on (ph2.hostname) ph2.id
      from public.portal_hosts ph2
      where ph2.company_id = new.id
        and ph2.role = 'redirect'
        and ph2.status = 'removed'
        and ph2.redirect_until is not null
        and ph2.redirect_until > now()
        and not exists (
          select 1 from public.portal_hosts other
          where other.hostname = ph2.hostname
            and other.status <> 'removed'
        )
      order by ph2.hostname, ph2.updated_at desc
    );
  end if;

  return new;
end;
$$;

drop trigger if exists companies_sync_portal_hosts on public.companies;
create trigger companies_sync_portal_hosts
  after insert or update of portal_slug, portal_status on public.companies
  for each row
  execute function public.companies_sync_portal_hosts();

-- ---------------------------------------------------------------------------
-- 7b. BEFORE DELETE company → schedule immediate unpark
-- ---------------------------------------------------------------------------
create or replace function public.companies_unpark_portal_hosts_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portal_hosts
  set desired = 'unparked',
      unpark_after = now(),
      next_attempt_at = now(),
      redirect_until = null,
      unpark_requests = 0,
      unpark_requested_at = null
  where company_id = old.id
    and status <> 'removed';
  return old;
end;
$$;

drop trigger if exists companies_unpark_portal_hosts_on_delete on public.companies;
create trigger companies_unpark_portal_hosts_on_delete
  before delete on public.companies
  for each row
  execute function public.companies_unpark_portal_hosts_on_delete();

-- ---------------------------------------------------------------------------
-- 8. claim_portal_host_jobs — service_role only
-- ---------------------------------------------------------------------------
create or replace function public.claim_portal_host_jobs(
  p_limit integer default 10,
  p_lock_seconds integer default 120,
  p_company_id uuid default null
)
returns setof public.portal_hosts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select ph.id
    from public.portal_hosts ph
    where ph.status <> 'removed'
      and (p_company_id is null or ph.company_id = p_company_id)
      and (ph.locked_until is null or ph.locked_until < now())
      and not (
        ph.status = 'failed'
        and ph.last_error_code in ('unpark_timeout', 'invalid_hostname')
      )
      and (
        (
          (
            ph.status in ('queued', 'parking', 'verifying', 'unparking', 'blocked')
            or (ph.status = 'failed' and ph.desired = 'unparked')
          )
          and ph.next_attempt_at <= now()
          and (
            ph.desired = 'parked'
            or (ph.desired = 'unparked' and coalesce(ph.unpark_after, now()) <= now())
          )
        )
        or (
          ph.role = 'redirect'
          and ph.desired = 'parked'
          and ph.redirect_until is not null
          and ph.redirect_until <= now()
          and ph.next_attempt_at <= now()
        )
        or (
          ph.desired = 'unparked'
          and ph.status not in ('unparking', 'removed')
          and coalesce(ph.unpark_after, now()) <= now()
          and ph.next_attempt_at <= now()
        )
      )
    order by ph.next_attempt_at asc nulls first
    limit greatest(1, least(coalesce(p_limit, 10), 50))
    for update of ph skip locked
  ),
  locked as (
    update public.portal_hosts ph
    set locked_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lock_seconds, 120), 600))),
        desired = case
          when ph.role = 'redirect'
               and ph.desired = 'parked'
               and ph.redirect_until is not null
               and ph.redirect_until <= now()
            then 'unparked'
          else ph.desired
        end,
        unpark_after = case
          when ph.role = 'redirect'
               and ph.desired = 'parked'
               and ph.redirect_until is not null
               and ph.redirect_until <= now()
            then coalesce(ph.unpark_after, now())
          else ph.unpark_after
        end,
        unpark_requests = case
          when ph.role = 'redirect'
               and ph.desired = 'parked'
               and ph.redirect_until is not null
               and ph.redirect_until <= now()
            then 0
          else ph.unpark_requests
        end,
        unpark_requested_at = case
          when ph.role = 'redirect'
               and ph.desired = 'parked'
               and ph.redirect_until is not null
               and ph.redirect_until <= now()
            then null
          else ph.unpark_requested_at
        end,
        status = case
          when (
                 ph.desired = 'unparked'
                 or (
                   ph.role = 'redirect'
                   and ph.desired = 'parked'
                   and ph.redirect_until is not null
                   and ph.redirect_until <= now()
                 )
               )
               and not (
                 ph.status = 'failed'
                 and ph.last_error_code in ('unpark_timeout', 'invalid_hostname')
               )
            then case
              when ph.status = 'removed' then ph.status
              else 'unparking'
            end
          else ph.status
        end
    where ph.id in (select id from due)
    returning ph.*
  )
  select * from locked;
end;
$$;

revoke all on function public.claim_portal_host_jobs(integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_portal_host_jobs(integer, integer, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Backfill existing portal_slug companies (no live email)
-- ---------------------------------------------------------------------------
insert into public.portal_hosts (
  company_id, slug, hostname, role, desired, status,
  attempts, next_attempt_at, notify_on_live
)
select
  c.id,
  c.portal_slug,
  public.portal_host_hostname(c.portal_slug),
  'primary',
  'parked',
  'queued',
  0,
  now(),
  false
from public.companies c
where c.portal_slug is not null
  and not exists (
    select 1 from public.portal_hosts ph
    where ph.hostname = public.portal_host_hostname(c.portal_slug)
      and ph.status <> 'removed'
  );

update public.companies c
set subdomain_status = coalesce(nullif(c.subdomain_status, 'none'), 'pending'),
    subdomain_updated_at = coalesce(c.subdomain_updated_at, now())
where c.portal_slug is not null
  and (c.subdomain_status is null or c.subdomain_status = 'none');

commit;
