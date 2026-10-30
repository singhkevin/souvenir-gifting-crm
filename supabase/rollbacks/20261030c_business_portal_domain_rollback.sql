-- Removes the microsite-domain check from business accounts.
-- Restores the work-email trigger from 20261030b. Does not block or delete accounts.
-- Do not apply from the agent.

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

  -- Grandfather: an existing free-email business account keeps working
  -- until staff change the email or the role.
  if tg_op = 'UPDATE'
     and new.role is not distinct from old.role
     and lower(coalesce(new.email, '')) is not distinct from lower(coalesce(old.email, '')) then
    return new;
  end if;

  if not public.is_work_email(new.email) then
    raise exception 'work email required';
  end if;

  return new;
end;
$$;

comment on function public.enforce_business_email_domain() is
  'New business accounts, role changes, and email changes need a work email. Unchanged free-email accounts stay.';

commit;
