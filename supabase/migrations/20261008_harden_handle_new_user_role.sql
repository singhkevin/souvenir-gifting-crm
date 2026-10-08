-- Harden the auth.users -> public.profiles sign-up trigger.
--
-- Before: role and company_id were read from raw_user_meta_data, which any caller of
-- the public signUp API (anon key) controls, so anyone could self-register as admin.
--
-- After: role and company_id are only honoured from raw_app_meta_data, which only the
-- service role / postgres can write. Every other sign-up becomes client_user with no
-- company. Server-side creation paths (createPortalClient, provision_client_user) still
-- set the final role/company on the profile right after the auth user is inserted.
--
-- Rollback: supabase/rollbacks/20261008_harden_handle_new_user_role_rollback.sql

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
