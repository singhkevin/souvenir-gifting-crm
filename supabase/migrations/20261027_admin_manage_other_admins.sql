-- An active admin may change or remove another admin from the Team page.
-- 20261013_admin_guard.sql allowed that only for the service role, so the
-- Team page update (the signed-in admin's JWT) raised
-- "Only the service role can change or remove another admin".
--
-- Still refused:
--   demote, deactivate, or delete the last active admin (including service role)
--   an admin deactivating their own account
-- Not applied. Rollback: supabase/rollbacks/20261027_admin_manage_other_admins_rollback.sql

create or replace function public.guard_admin_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_privileged boolean := coalesce(auth.role(), '') = 'service_role' or auth.uid() is null;
  v_actor_admin boolean := false;
  v_losing_admin boolean;
begin
  if old.role <> 'admin' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    v_losing_admin := true;
  else
    v_losing_admin := new.role is distinct from 'admin'
      or coalesce(new.is_active, false) is distinct from coalesce(old.is_active, false);
  end if;

  if not v_losing_admin then
    return new;
  end if;

  if v_uid is not null and not v_privileged then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_uid
        and p.role = 'admin'
        and p.is_active
    ) into v_actor_admin;
  end if;

  if coalesce(old.is_active, false)
     and (tg_op = 'DELETE' or new.role is distinct from 'admin' or not coalesce(new.is_active, false))
     and not exists (
       select 1 from public.profiles p
       where p.role = 'admin' and p.is_active and p.id <> old.id
     ) then
    raise exception 'The last active admin cannot be demoted, deactivated, or removed'
      using errcode = '42501';
  end if;

  if not v_privileged
     and tg_op = 'UPDATE'
     and old.id = v_uid
     and coalesce(old.is_active, false)
     and not coalesce(new.is_active, false) then
    raise exception 'You cannot deactivate your own admin account'
      using errcode = '42501';
  end if;

  if not v_privileged and not v_actor_admin and old.id is distinct from v_uid then
    raise exception 'Only an active admin can change or remove another admin'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.guard_admin_profiles() from public, anon, authenticated;

drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin
  before update of role, is_active or delete on public.profiles
  for each row
  execute function public.guard_admin_profiles();
