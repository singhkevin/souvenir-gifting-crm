-- Run after 20261031_portal_self_signup.sql. The block always raises so the
-- transaction rolls back. A missing function or a guard that does not compare
-- the caller to the row fails first.
-- Not part of npm test. test/portal-signup.test.ts reads the migration text.

begin;

do $$
declare
  v_guard text;
  v_access text;
begin
  if to_regprocedure('public.portal_access()') is null then
    raise exception 'portal_access() is missing';
  end if;
  if to_regprocedure('public.guard_portal_profile()') is null then
    raise exception 'guard_portal_profile() is missing';
  end if;

  v_guard := pg_get_functiondef('public.guard_portal_profile()'::regprocedure);
  if position('old.id is distinct from auth.uid()' in v_guard) = 0 then
    raise exception 'guard does not refuse a change to the caller''s own row';
  end if;
  if position('You cannot change this account role, company, or approval' in v_guard) = 0 then
    raise exception 'guard exception text missing';
  end if;
  if position('service_role' in v_guard) = 0 then
    raise exception 'guard does not keep a service-role path';
  end if;

  v_access := pg_get_functiondef('public.portal_access()'::regprocedure);
  if position('pending' in v_access) = 0 or position('approved' in v_access) = 0 then
    raise exception 'portal_access() does not return pending and approved';
  end if;

  if position('public.portal_access()' in pg_get_functiondef('public.portal_unit_price(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure)) = 0 then
    raise exception 'corporate prices are not gated on portal_access()';
  end if;

  raise exception 'portal self signup check passed and rolled back';
end $$;
