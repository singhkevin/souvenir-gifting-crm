-- Backup of live public.handle_new_user() on Souvenir (project ajysowosgjaipczrwpfv)
-- Captured 2026-10-08 before migration harden_handle_new_user_role. Run this to revert.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (id, full_name, email, role, company_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'sales'),
    nullif(new.raw_user_meta_data->>'company_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;
