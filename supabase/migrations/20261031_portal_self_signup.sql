-- Company portal self sign-up and per-company approval.
-- Builds on business_access() / email_domain_rules (20261030 through 20261030c).
-- Does not apply itself. The file has its own begin/commit, same as the other migrations.
-- Company linking stays in app_metadata (service role). User metadata is ignored.
-- A signed-in user cannot approve themselves or change role or company: Postgres RLS
-- cannot compare old and new values, so profiles_guard_portal_identity does that.

begin;

alter table public.companies
  add column if not exists portal_signup_mode text not null default 'manual';

alter table public.companies drop constraint if exists companies_portal_signup_mode_check;
alter table public.companies
  add constraint companies_portal_signup_mode_check
  check (portal_signup_mode in ('off', 'manual', 'auto_domain', 'auto_all'));

comment on column public.companies.portal_signup_mode is
  'off: no self sign-up, staff adds are active. manual: every new portal user waits. auto_domain: a self sign-up on a listed domain is active after email confirmation. auto_all: staff and company-admin invites are active too. Default manual.';

alter table public.profiles
  add column if not exists portal_approval text not null default 'approved',
  add column if not exists portal_signup_source text,
  add column if not exists portal_approved_by uuid references public.profiles (id),
  add column if not exists portal_approved_at timestamptz,
  add column if not exists portal_domain_exception boolean not null default false,
  add column if not exists portal_signup_notified_at timestamptz;

alter table public.profiles drop constraint if exists profiles_portal_approval_check;
alter table public.profiles
  add constraint profiles_portal_approval_check
  check (portal_approval in ('pending', 'approved', 'rejected'));

alter table public.profiles drop constraint if exists profiles_portal_signup_source_check;
alter table public.profiles
  add constraint profiles_portal_signup_source_check
  check (portal_signup_source is null or portal_signup_source in ('self', 'staff', 'invite'));

comment on column public.profiles.portal_approval is
  'Company portal access. Existing rows stay approved. Pending users can sign in and see Awaiting approval only.';
comment on column public.profiles.portal_signup_source is
  'self, staff, or invite. Null on accounts created before this column.';
comment on column public.profiles.portal_domain_exception is
  'Staff recorded an explicit exception to the company email-domain list. Self sign-up cannot set this.';

create index if not exists profiles_portal_pending_idx
  on public.profiles (company_id)
  where portal_approval = 'pending';

-- Listed company domains still pass, including a free inbox the company listed.
-- An empty list still allows a work email. Free and disposable domains do not,
-- unless portal_domain_exception is set by the service role. A business allow
-- rule does not open the microsite.
create or replace function public.enforce_portal_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  domains text[];
  email_domain text;
begin
  if new.role not in ('client_admin', 'client_user') or new.company_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.role is not distinct from old.role
     and new.company_id is not distinct from old.company_id
     and lower(coalesce(new.email, '')) is not distinct from lower(coalesce(old.email, '')) then
    return new;
  end if;

  if coalesce(new.portal_domain_exception, false) then
    return new;
  end if;

  select c.allowed_email_domains
    into domains
  from public.companies c
  where c.id = new.company_id;

  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));

  if domains is not null and cardinality(domains) > 0 then
    if email_domain = '' or not exists (
      select 1
      from unnest(domains) as allowed(domain)
      where lower(btrim(allowed.domain)) = email_domain
    ) then
      raise exception 'portal email domain not allowed';
    end if;
    return new;
  end if;

  if email_domain <> '' and exists (
    select 1
    from public.email_domain_rules r
    where r.domain = email_domain
      and r.rule in ('block_free', 'block_disposable')
  ) then
    raise exception 'portal email domain not allowed';
  end if;

  return new;
end;
$$;

comment on function public.enforce_portal_email_domain() is
  'Client portal emails must match the company list when one is set. An empty list still blocks free and disposable domains unless portal_domain_exception is true. Existing unchanged rows stay.';

-- Trusted app_metadata only. Same rule as 20261008, plus the portal approval fields.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_role public.app_role := 'client_user';
  v_company_id uuid := null;
  v_approval text := 'approved';
  v_source text := null;
  v_exception boolean := false;
begin
  begin
    if coalesce(new.raw_app_meta_data->>'role', '') <> '' then
      v_role := (new.raw_app_meta_data->>'role')::public.app_role;
    end if;
    v_company_id := nullif(new.raw_app_meta_data->>'company_id', '')::uuid;
    if coalesce(new.raw_app_meta_data->>'portal_approval', '') in ('pending', 'approved', 'rejected') then
      v_approval := new.raw_app_meta_data->>'portal_approval';
    end if;
    if coalesce(new.raw_app_meta_data->>'portal_signup_source', '') in ('self', 'staff', 'invite') then
      v_source := new.raw_app_meta_data->>'portal_signup_source';
    end if;
    v_exception := coalesce(new.raw_app_meta_data->>'portal_domain_exception', '') = 'true';
  exception when invalid_text_representation then
    v_role := 'client_user';
    v_company_id := null;
    v_approval := 'approved';
    v_source := null;
    v_exception := false;
  end;

  insert into public.profiles (
    id, full_name, email, role, company_id,
    portal_approval, portal_signup_source, portal_domain_exception
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_company_id,
    v_approval,
    v_source,
    v_exception
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.guard_portal_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_privileged boolean := coalesce(auth.role(), '') = 'service_role' or auth.uid() is null;
  v_identity_changed boolean;
begin
  if v_privileged then
    return new;
  end if;

  v_identity_changed :=
    new.role is distinct from old.role
    or new.company_id is distinct from old.company_id
    or new.portal_approval is distinct from old.portal_approval
    or new.portal_approved_by is distinct from old.portal_approved_by
    or new.portal_approved_at is distinct from old.portal_approved_at
    or new.portal_signup_source is distinct from old.portal_signup_source
    or new.portal_domain_exception is distinct from old.portal_domain_exception;

  if not v_identity_changed then
    return new;
  end if;

  -- Team page: an admin may assign a staff role to someone else.
  -- They still cannot set portal approval, and they cannot change their own row.
  if old.id is distinct from auth.uid()
     and new.portal_approval is not distinct from old.portal_approval
     and new.portal_approved_by is not distinct from old.portal_approved_by
     and new.portal_approved_at is not distinct from old.portal_approved_at
     and new.portal_signup_source is not distinct from old.portal_signup_source
     and new.portal_domain_exception is not distinct from old.portal_domain_exception
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.role = 'admin' and p.is_active
     ) then
    return new;
  end if;

  raise exception 'You cannot change this account role, company, or approval'
    using errcode = '42501';
end;
$$;

revoke all on function public.guard_portal_profile() from public, anon, authenticated;

drop trigger if exists profiles_guard_portal_identity on public.profiles;
create trigger profiles_guard_portal_identity
  before update of role, company_id, portal_approval, portal_approved_by, portal_approved_at, portal_signup_source, portal_domain_exception
  on public.profiles
  for each row
  execute function public.guard_portal_profile();

comment on function public.guard_portal_profile() is
  'Signed-in users cannot self-approve, change their company, or escalate their role. Service role applies decisions. An admin may still assign staff roles to someone else.';

create or replace function public.portal_access()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_approval text;
begin
  select p.role, p.is_active, p.portal_approval
    into v_role, v_active, v_approval
  from public.profiles p
  where p.id = auth.uid();

  if not found or v_role not in ('client_admin', 'client_user') then
    return 'none';
  end if;
  if coalesce(v_active, false) is false then
    return 'blocked';
  end if;
  if v_approval = 'rejected' then
    return 'rejected';
  end if;
  if v_approval = 'approved' then
    return 'approved';
  end if;
  return 'pending';
end;
$$;

comment on function public.portal_access() is
  'none, pending, approved, rejected, or blocked for the signed-in company portal user. Prices and portal orders require approved.';

revoke all on function public.portal_access() from public, anon;
grant execute on function public.portal_access() to authenticated, service_role;

do $patch$
declare
  v_def text;
  v_old text := $old$and p.role in ('client_admin', 'client_user')
          and p.company_id = p_company_id$old$;
  v_new text := $new$and p.role in ('client_admin', 'client_user')
          and public.portal_access() = 'approved'
          and p.company_id = p_company_id$new$;
begin
  v_def := pg_get_functiondef('public.portal_unit_price(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure);
  if position('public.portal_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'portal_unit_price: corporate gate anchor missing. Apply 20261027_portal_business_separation.sql first.';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

do $patch$
declare
  v_def text;
  v_old text := $old$if not public.is_client() then
        raise exception 'Not permitted to place this order';
      end if;$old$;
  v_new text := $new$if public.portal_access() is distinct from 'approved' then
        raise exception 'Awaiting approval';
      end if;
      if not public.is_client() then
        raise exception 'Not permitted to place this order';
      end if;$new$;
begin
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  if position('public.portal_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'place_direct_order: client gate anchor missing';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

do $patch$
declare
  v_def text;
  v_old text := $old$if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;$old$;
  v_new text := $new$if public.portal_access() is distinct from 'approved' then
    raise exception 'Awaiting approval';
  end if;
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;$new$;
begin
  v_def := pg_get_functiondef('public.client_respond_quotation(uuid,text,text,uuid[])'::regprocedure);
  if position('public.portal_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'client_respond_quotation: client gate anchor missing';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

commit;
