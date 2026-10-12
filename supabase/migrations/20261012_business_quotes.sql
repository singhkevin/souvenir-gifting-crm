-- Business quote response. Accept, reject, and request-revision do not create an order.
-- Expiry is limited to business accounts and is service_role only.

alter table public.quotations
  add column if not exists revision_of uuid references public.quotations (id),
  add column if not exists revision_requested_at timestamptz,
  add column if not exists expiry_reminder_sent_at timestamptz,
  add column if not exists expired_notified_at timestamptz;

comment on column public.quotations.revision_of is
  'Previous quotation this draft revises. Set when staff create a revision.';
comment on column public.quotations.revision_requested_at is
  'When the business asked for a revision. The quotation stays sent or viewed until staff supersede it.';

alter table public.org_settings
  add column if not exists quote_validity_days integer not null default 14;

alter table public.org_settings drop constraint if exists org_settings_quote_validity_days_check;
alter table public.org_settings
  add constraint org_settings_quote_validity_days_check
  check (quote_validity_days between 1 and 90);

create or replace function public.business_respond_quotation(
  p_quotation_id uuid,
  p_action text,
  p_comment text default null,
  p_item_ids uuid[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  q public.quotations%rowtype;
  v_company uuid := public.business_company_id();
  v_ids uuid[];
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if not public.is_business() or v_company is null then
    raise exception 'Only a business account can respond to this quotation';
  end if;
  if v_action not in ('accept', 'reject', 'revise') then
    raise exception 'Invalid response';
  end if;

  select * into q
  from public.quotations
  where id = p_quotation_id
  for update;

  if not found or q.company_id is distinct from v_company then
    raise exception 'Quotation not found';
  end if;

  if v_action = 'accept' and q.status = 'accepted' then
    return q.id;
  end if;
  if v_action = 'reject' and q.status = 'rejected' then
    return q.id;
  end if;
  if v_action = 'revise' and q.revision_requested_at is not null and q.status in ('sent', 'viewed') then
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
    raise exception 'This quotation has expired';
  end if;

  if v_action = 'revise' then
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
    return q.id;
  end if;

  if v_action = 'reject' then
    update public.quotation_items
    set client_response = 'rejected'
    where quotation_id = q.id;

    update public.quotations
    set status = 'rejected',
        client_comment = coalesce(v_comment, client_comment),
        responded_at = now(),
        updated_at = now()
    where id = q.id;

    perform public.notify_users(
      'internal',
      q.company_id,
      'Quotation declined',
      coalesce(v_comment, ''),
      '/crm/quotations/' || q.id::text
    );
    return q.id;
  end if;

  if p_item_ids is null then
    select coalesce(array_agg(id), '{}'::uuid[])
      into v_ids
    from public.quotation_items
    where quotation_id = q.id;
  else
    select coalesce(array_agg(distinct x), '{}'::uuid[])
      into v_ids
    from unnest(p_item_ids) as x
    where x is not null;
  end if;

  if coalesce(cardinality(v_ids), 0) < 1 then
    raise exception 'Select at least one line to accept';
  end if;

  if exists (
    select 1
    from unnest(v_ids) as x
    where not exists (
      select 1 from public.quotation_items qi
      where qi.id = x and qi.quotation_id = q.id
    )
  ) then
    raise exception 'One or more items do not belong to this quotation';
  end if;

  update public.quotation_items
  set client_response = case when id = any (v_ids) then 'accepted' else 'rejected' end
  where quotation_id = q.id;

  update public.quotations
  set status = 'accepted',
      client_comment = coalesce(v_comment, client_comment),
      responded_at = now(),
      updated_at = now()
  where id = q.id;

  if q.requirement_id is not null then
    update public.quotations
    set status = 'rejected',
        client_comment = coalesce(client_comment, 'Another quotation was accepted'),
        updated_at = now()
    where requirement_id = q.requirement_id
      and id <> q.id
      and status in ('sent', 'viewed');
  end if;

  perform public.notify_users(
    'internal',
    q.company_id,
    'Quotation accepted',
    'The business accepted selected lines. No order is created until store checkout.',
    '/crm/quotations/' || q.id::text
  );

  return q.id;
end;
$$;

revoke all on function public.business_respond_quotation(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.business_respond_quotation(uuid, text, text, uuid[]) to authenticated;

comment on function public.business_respond_quotation(uuid, text, text, uuid[]) is
  'Business accept, reject, or revision request. Does not create an order.';

create or replace function public.business_mark_quotation_viewed(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.business_company_id();
begin
  if not public.is_business() or v_company is null then
    raise exception 'Only a business account can view this quotation';
  end if;

  update public.quotations
  set status = 'viewed',
      updated_at = now()
  where id = p_quotation_id
    and company_id = v_company
    and status = 'sent';
end;
$$;

revoke all on function public.business_mark_quotation_viewed(uuid) from public, anon;
grant execute on function public.business_mark_quotation_viewed(uuid) to authenticated;

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
