-- Employees of a microsite client cannot open a business account on that domain.
-- An allow rule does not override this. account_type direct is not a microsite.
-- Existing business rows are not updated, so they keep working until the email or role changes.
-- Do not apply from the agent. Apply after 20261030b_business_email_domains.sql.

begin;

create or replace function public.enforce_business_email_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'business_user' then
    return new;
  end if;

  -- Grandfather: an existing free-email or shared-domain business account keeps
  -- working until staff change the email or the role.
  if tg_op = 'UPDATE'
     and new.role is not distinct from old.role
     and lower(coalesce(new.email, '')) is not distinct from lower(coalesce(old.email, '')) then
    return new;
  end if;

  if not public.is_work_email(new.email) then
    raise exception 'work email required';
  end if;

  if exists (
    select 1
    from public.companies c
    where c.account_type = 'corporate'
      and c.status = 'active'
      and c.allowed_email_domains is not null
      and exists (
        select 1
        from unnest(c.allowed_email_domains) as allowed(domain)
        where lower(btrim(allowed.domain)) = public.email_domain_of(new.email)
      )
  ) then
    raise exception 'company portal email';
  end if;

  return new;
end;
$$;

comment on function public.enforce_business_email_domain() is
  'New business accounts need a work email that is not an active corporate portal domain. Unchanged accounts stay. Direct customers are not treated as microsites.';

commit;
