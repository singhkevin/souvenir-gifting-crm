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
