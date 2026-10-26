create or replace function pg_temp.role_probe() returns jsonb language plpgsql as $p$
declare u record; r jsonb := '{}'; v jsonb;
begin
  for u in select id, role::text role, is_active, coalesce(full_name,'?') nm from public.profiles where role not in ('client_user','gift_employee') or not is_active order by role, is_active loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.id, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    v := jsonb_build_object('admin', public.is_admin(), 'cur', public."current_role"(),
      'orders', (select count(*) from public.orders), 'companies', (select count(*) from public.companies),
      'contacts', (select count(*) from public.contacts), 'leads', (select count(*) from public.leads),
      'invoices', (select count(*) from public.invoices), 'quotes', (select count(*) from public.quotations),
      'tasks', (select count(*) from public.tasks), 'profiles', (select count(*) from public.profiles));
    execute 'reset role';
    r := r || jsonb_build_object(u.role || case when u.is_active then '' else '(inactive)' end || ':' || left(u.id::text, 4), v);
  end loop;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $p$;
do $t$
declare b jsonb; a jsonb; rr jsonb; changed jsonb := '{}'; k text;
  fmd5 text; pmd5 text; fmd5b text; pmd5b text;
begin
  select md5(string_agg(pg_get_functiondef(p.oid), '' order by p.proname)) into fmd5 from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('has_any_role','is_admin','current_role');
  select md5(string_agg(policyname||coalesce(qual,''), '' order by policyname)) into pmd5 from pg_policies where schemaname='public';
  b := pg_temp.role_probe();
  execute $m$
-- 20261023c_role_active_checks.sql
-- Deactivating a team member (Team page, Status = Inactive) must also take away their database access.
-- Today the app sends an inactive user to /login, but the role helpers the RLS policies use do not look
-- at profiles.is_active, so a still-valid session could read and write through the API:
--   has_any_role (behind can_crm, can_sales, can_ops, can_finance, can_management_read, can_orders_read,
--   can_orders_write), is_admin, current_role, and the inline sales/operations checks in five select policies.
-- This adds the is_active check. Active users keep exactly the access they have today.
-- Not applied. Needs Kevin's approval. Rollback: supabase/rollbacks/20261023c_role_active_checks_rollback.sql

create or replace function public.has_any_role(roles public.app_role[])
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select role = any(roles) from public.profiles where id = auth.uid() and is_active), false);
$function$;

create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and is_active), false);
$function$;

create or replace function public."current_role"()
 returns public.app_role
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select role from public.profiles where id = auth.uid() and is_active;
$function$;

alter policy orders_select on public.orders using (
(can_management_read() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'sales'::app_role)))) AND ((owner_id = auth.uid()) OR (assigned_to = auth.uid()))) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'operations'::app_role)))) AND ((assigned_to = auth.uid()) OR (operations_user_id = auth.uid()) OR (current_department_id = ( SELECT profiles.department_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM order_assignments oa
  WHERE ((oa.order_id = orders.id) AND (oa.assigned_to = auth.uid())))))))
);

alter policy companies_select on public.companies using (
(can_management_read() OR can_ops() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'sales'::app_role)))) AND (owner_id = auth.uid())) OR (is_client() AND (id = client_company_id())))
);

alter policy contacts_select on public.contacts using (
(can_management_read() OR can_ops() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'sales'::app_role)))) AND (company_id IN ( SELECT companies.id
   FROM companies
  WHERE (companies.owner_id = auth.uid())))) OR (is_client() AND (company_id = client_company_id())))
);

alter policy slug_history_select on public.slug_history using (
(can_management_read() OR can_ops() OR can_finance() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'sales'::app_role)))))
);

alter policy portal_hosts_select on public.portal_hosts using (
(is_admin() OR can_crm() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND p.is_active AND (p.role = 'sales'::app_role)))))
);

$m$;
  a := pg_temp.role_probe();
  for k in select jsonb_object_keys(b) loop
    if b->k is distinct from a->k then changed := changed || jsonb_build_object(k, jsonb_build_object('before', b->k, 'after', a->k)); end if;
  end loop;
  execute $m$
-- Rollback for 20261023c_role_active_checks.sql: restores the definitions live on 2026-10-23.

CREATE OR REPLACE FUNCTION public.has_any_role(roles app_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role = any(roles) from public.profiles where id = auth.uid()), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$function$;

CREATE OR REPLACE FUNCTION public."current_role"()
 RETURNS app_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.profiles where id = auth.uid();
$function$;

alter policy orders_select on public.orders using (
(can_management_read() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'sales'::app_role)))) AND ((owner_id = auth.uid()) OR (assigned_to = auth.uid()))) OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'operations'::app_role)))) AND ((assigned_to = auth.uid()) OR (operations_user_id = auth.uid()) OR (current_department_id = ( SELECT profiles.department_id
   FROM profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM order_assignments oa
  WHERE ((oa.order_id = orders.id) AND (oa.assigned_to = auth.uid())))))))
);

alter policy companies_select on public.companies using (
(can_management_read() OR can_ops() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'sales'::app_role)))) AND (owner_id = auth.uid())) OR (is_client() AND (id = client_company_id())))
);

alter policy contacts_select on public.contacts using (
(can_management_read() OR can_ops() OR can_finance() OR ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'sales'::app_role)))) AND (company_id IN ( SELECT companies.id
   FROM companies
  WHERE (companies.owner_id = auth.uid())))) OR (is_client() AND (company_id = client_company_id())))
);

alter policy slug_history_select on public.slug_history using (
(can_management_read() OR can_ops() OR can_finance() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'sales'::app_role)))))
);

alter policy portal_hosts_select on public.portal_hosts using (
(is_admin() OR can_crm() OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'sales'::app_role)))))
);

$m$;
  rr := pg_temp.role_probe();
  select md5(string_agg(pg_get_functiondef(p.oid), '' order by p.proname)) into fmd5b from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public' and p.proname in ('has_any_role','is_admin','current_role');
  select md5(string_agg(policyname||coalesce(qual,''), '' order by policyname)) into pmd5b from pg_policies where schemaname='public';
  raise exception 'ROLE_TRIAL %', jsonb_build_object('users_probed', (select count(*) from jsonb_object_keys(b)), 'changed_by_migration', changed,
    'rollback_restores_access', rr = b, 'fn_md5_restored', fmd5 = fmd5b, 'policies_md5_restored', pmd5 = pmd5b);
end $t$;