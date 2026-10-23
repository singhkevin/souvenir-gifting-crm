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
