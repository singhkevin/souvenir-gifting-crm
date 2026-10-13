-- Undoes 20261014_quote_requests.sql.
-- Restores business-only expiry from 20261012_business_quotes.sql.

begin;

drop function if exists public.client_request_quote_revision(uuid, text);

create or replace function public.expire_business_quotations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_count integer := 0;
begin
  if not v_service then
    raise exception 'Not permitted';
  end if;

  update public.quotations q
  set status = 'expired',
      updated_at = now()
  from public.companies c
  where q.company_id = c.id
    and c.account_type = 'business'
    and q.status in ('sent', 'viewed')
    and q.valid_until is not null
    and q.valid_until < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_business_quotations() from public, anon, authenticated;
grant execute on function public.expire_business_quotations() to service_role;

drop function if exists public.expire_quotations();

notify pgrst, 'reload schema';

commit;
