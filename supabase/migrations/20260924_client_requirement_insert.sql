-- Portal clients may create a requirement for their own company.
-- Ownership stays with the company account manager so it remains in the sales pipeline.

drop policy if exists req_insert on public.requirements;

create policy req_insert on public.requirements
  for insert with check (
    (public.can_crm() and (public.is_admin() or owner_id = auth.uid()))
    or (
      public.is_client()
      and company_id = public.client_company_id()
      and owner_id is not distinct from (
        select c.owner_id from public.companies c where c.id = public.client_company_id()
      )
    )
  );
