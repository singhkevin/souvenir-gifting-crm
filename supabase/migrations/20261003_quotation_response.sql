-- Client and staff quotation accept/reject with audit fields and sibling quote handling.

create or replace function public.respond_quotation(
  p_quotation_id uuid,
  p_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  q public.quotations%rowtype;
  v_allowed boolean := false;
begin
  if p_status not in ('accepted', 'rejected') then
    raise exception 'Invalid response status';
  end if;

  select * into q
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found then
    raise exception 'Quotation not found';
  end if;

  if public.is_client() then
    if q.company_id is not distinct from public.client_company_id() then
      v_allowed := true;
    end if;
  elsif public.can_management_read()
    or (public.can_sales() and (public.is_admin() or q.owner_id = auth.uid()))
  then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Not permitted to respond to this quotation';
  end if;

  if q.status not in ('sent', 'viewed') then
    raise exception 'Quotation cannot be responded to in its current state';
  end if;

  if q.valid_until is not null and q.valid_until < current_date then
    update public.quotations
    set status = 'expired', updated_at = now()
    where id = q.id;
    raise exception 'This quotation has expired';
  end if;

  update public.quotations
  set
    status = p_status::quotation_status,
    client_comment = coalesce(nullif(trim(p_comment), ''), client_comment),
    responded_at = now(),
    updated_at = now()
  where id = p_quotation_id;

  if p_status = 'accepted' and q.requirement_id is not null then
    update public.quotations
    set status = 'rejected', updated_at = now()
    where requirement_id = q.requirement_id
      and id <> p_quotation_id
      and status in ('sent', 'viewed');
  end if;

  perform public.notify_users(
    'internal',
    q.company_id,
    case when p_status = 'accepted' then 'Quotation accepted' else 'Quotation declined' end,
    coalesce(nullif(trim(p_comment), ''), ''),
    '/crm/quotations/' || p_quotation_id::text
  );
end;
$$;

create or replace function public.client_respond_quotation(
  p_quotation_id uuid,
  p_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;
  perform public.respond_quotation(p_quotation_id, p_status, p_comment);
end;
$$;

revoke all on function public.respond_quotation(uuid, text, text) from public;
revoke all on function public.client_respond_quotation(uuid, text, text) from public;
grant execute on function public.respond_quotation(uuid, text, text) to authenticated;
grant execute on function public.client_respond_quotation(uuid, text, text) to authenticated;
