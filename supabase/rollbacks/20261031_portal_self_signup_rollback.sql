-- Reverses 20261031_portal_self_signup.sql.
-- Restores the 20261027 domain trigger and the 20261008 sign-up trigger.
-- Does not delete portal users. Drops the approval columns.
-- Run this before rolling back 20261030c. Has its own begin/commit.

begin;

do $patch$
declare
  v_def text;
  v_new text := $new$and p.role in ('client_admin', 'client_user')
          and public.portal_access() = 'approved'
          and p.company_id = p_company_id$new$;
  v_old text := $old$and p.role in ('client_admin', 'client_user')
          and p.company_id = p_company_id$old$;
begin
  v_def := pg_get_functiondef('public.portal_unit_price(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure);
  if position('public.portal_access()' in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

do $patch$
declare
  v_def text;
  v_new text := $new$if public.portal_access() is distinct from 'approved' then
        raise exception 'Awaiting approval';
      end if;
      if not public.is_client() then
        raise exception 'Not permitted to place this order';
      end if;$new$;
  v_old text := $old$if not public.is_client() then
        raise exception 'Not permitted to place this order';
      end if;$old$;
begin
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  if position('Awaiting approval' in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

do $patch$
declare
  v_def text;
  v_new text := $new$if public.portal_access() is distinct from 'approved' then
    raise exception 'Awaiting approval';
  end if;
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;$new$;
  v_old text := $old$if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;$old$;
begin
  v_def := pg_get_functiondef('public.client_respond_quotation(uuid,text,text,uuid[])'::regprocedure);
  if position('Awaiting approval' in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

drop trigger if exists profiles_guard_portal_identity on public.profiles;
drop function if exists public.guard_portal_profile();
drop function if exists public.portal_access();

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

  select c.allowed_email_domains
    into domains
  from public.companies c
  where c.id = new.company_id;

  if domains is null or cardinality(domains) = 0 then
    return new;
  end if;

  email_domain := lower(split_part(coalesce(new.email, ''), '@', 2));
  if email_domain = '' or not exists (
    select 1
    from unnest(domains) as allowed(domain)
    where lower(btrim(allowed.domain)) = email_domain
  ) then
    raise exception 'portal email domain not allowed';
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_role public.app_role := 'client_user';
  v_company_id uuid := null;
begin
  begin
    if coalesce(new.raw_app_meta_data->>'role', '') <> '' then
      v_role := (new.raw_app_meta_data->>'role')::public.app_role;
    end if;
    v_company_id := nullif(new.raw_app_meta_data->>'company_id', '')::uuid;
  exception when invalid_text_representation then
    v_role := 'client_user';
    v_company_id := null;
  end;

  insert into public.profiles (id, full_name, email, role, company_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_company_id
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

drop index if exists public.profiles_portal_pending_idx;

alter table public.profiles drop constraint if exists profiles_portal_signup_source_check;
alter table public.profiles drop constraint if exists profiles_portal_approval_check;
alter table public.profiles
  drop column if exists portal_signup_notified_at,
  drop column if exists portal_domain_exception,
  drop column if exists portal_approved_at,
  drop column if exists portal_approved_by,
  drop column if exists portal_signup_source,
  drop column if exists portal_approval;

alter table public.companies drop constraint if exists companies_portal_signup_mode_check;
alter table public.companies drop column if exists portal_signup_mode;

commit;
