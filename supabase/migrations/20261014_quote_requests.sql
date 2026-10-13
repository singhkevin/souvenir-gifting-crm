-- Client quote revision requests, and quote expiry for every account type.
-- Apply after 20261014_quote_line_totals.sql. Do not apply from the agent.

begin;

create or replace function public.client_request_quote_revision(
  p_quotation_id uuid,
  p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotations%rowtype;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_owner uuid;
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;

  select * into q
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found or q.company_id is distinct from public.client_company_id() then
    raise exception 'Quotation not found';
  end if;

  if q.revision_requested_at is not null and q.status in ('sent', 'viewed') then
    return q.id;
  end if;

  if q.status not in ('sent', 'viewed') then
    raise exception 'Quotation cannot be responded to in its current state';
  end if;

  if q.valid_until is not null and q.valid_until < current_date then
    update public.quotations
    set status = 'expired', updated_at = now()
    where id = q.id
      and status in ('sent', 'viewed');
    return q.id;
  end if;

  update public.quotations
  set revision_requested_at = now(),
      client_comment = coalesce(v_comment, client_comment),
      updated_at = now()
  where id = q.id;

  perform public.notify_users(
    'internal',
    q.company_id,
    'Quote revision requested',
    coalesce(v_comment, ''),
    '/crm/quotations/' || q.id::text
  );

  -- An active quotation owner is covered by notify_users.
  -- No owner uses the active company owner. An inactive owner goes to the default owner.
  if q.owner_id is null or not exists (
    select 1 from public.profiles p where p.id = q.owner_id and p.is_active
  ) then
    v_owner := null;
    if q.owner_id is null then
      select c.owner_id into v_owner
      from public.companies c
      join public.profiles p on p.id = c.owner_id and p.is_active
      where c.id = q.company_id;
    end if;
    if v_owner is null then
      select s.business_default_owner_id into v_owner
      from public.org_settings s
      join public.profiles p on p.id = s.business_default_owner_id and p.is_active
      limit 1;
    end if;
    if v_owner is not null then
      insert into public.notifications (user_id, audience, title, body, link)
      values (
        v_owner,
        'internal',
        'Quote revision requested',
        coalesce(v_comment, ''),
        '/crm/quotations/' || q.id::text
      );
    end if;
  end if;

  return q.id;
end;
$$;

revoke all on function public.client_request_quote_revision(uuid, text) from public, anon;
grant execute on function public.client_request_quote_revision(uuid, text) to authenticated;

comment on function public.client_request_quote_revision(uuid, text) is
  'Portal client asks for a revision. Sets revision_requested_at and client_comment. Does not create an order.';

create or replace function public.expire_quotations()
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

  update public.quotations
  set status = 'expired',
      updated_at = now()
  where status in ('sent', 'viewed')
    and valid_until is not null
    and valid_until < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_quotations() from public, anon, authenticated;
grant execute on function public.expire_quotations() to service_role;

comment on function public.expire_quotations() is
  'Expires sent and viewed quotations past valid_until for every account type. Service role only.';

create or replace function public.expire_business_quotations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.expire_quotations();
end;
$$;

revoke all on function public.expire_business_quotations() from public, anon, authenticated;
grant execute on function public.expire_business_quotations() to service_role;

comment on function public.expire_business_quotations() is
  'Compatibility wrapper. Expires quotations for every account type.';

notify pgrst, 'reload schema';

commit;
