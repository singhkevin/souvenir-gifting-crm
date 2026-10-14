-- Rolled-back check for presentation share access.
-- Run after 20261017_presentations.sql. Do not remove the final rollback.

begin;

do $$
begin
  if has_function_privilege('anon', 'public.is_presentation_staff()', 'execute') then
    raise exception 'anon must not execute is_presentation_staff';
  end if;
  if not has_function_privilege('anon', 'public.presentation_public(text)', 'execute') then
    raise exception 'anon must execute presentation_public';
  end if;
  if has_table_privilege('anon', 'public.presentations', 'select') then
    raise exception 'anon must not select presentations';
  end if;
  if has_table_privilege('anon', 'public.presentation_items', 'select') then
    raise exception 'anon must not select presentation items';
  end if;
  if position('i.price' in pg_get_functiondef('public.presentation_public(text)'::regprocedure)) > 0 then
    raise exception 'public payload must not read the slide price';
  end if;
end $$;

rollback;
