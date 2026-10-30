-- Business prices and quote RPCs require an approved business account.
-- public.business_access() is the database half of src/lib/business/access-state.ts.
-- Pending, rejected, blocked, and non-business callers cannot read business prices or raise quotes.
-- Store prices, corporate prices, the service role, and pricing staff are unchanged.
-- Does not change the price ladder. Do not apply from the agent. Idempotent.

begin;

create or replace function public.business_access()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_company uuid;
  v_type text;
  v_verification text;
  v_status text;
begin
  select p.role, p.is_active, p.company_id, c.account_type, c.business_verification, c.status
    into v_role, v_active, v_company, v_type, v_verification, v_status
  from public.profiles p
  left join public.companies c on c.id = p.company_id
  where p.id = auth.uid();

  if not found or v_role is distinct from 'business_user' then
    return 'none';
  end if;
  -- Block deactivates the login and the company. Either one closes the account.
  if coalesce(v_active, false) is false or v_status = 'inactive' then
    return 'blocked';
  end if;
  -- account_type 'direct' and corporate rows are not the business portal.
  if v_company is null or v_type is distinct from 'business' then
    return 'none';
  end if;
  if v_verification = 'rejected' then
    return 'rejected';
  end if;
  if v_verification = 'verified' then
    return 'verified';
  end if;
  return 'pending';
end;
$$;

comment on function public.business_access() is
  'none, pending, verified, rejected, or blocked for the signed-in business account. Prices and quote RPCs require verified.';

revoke all on function public.business_access() from public, anon;
grant execute on function public.business_access() to authenticated, service_role;

-- portal_unit_price: keep the 20261027 separation, and require a verified business account.
do $patch$
declare
  v_def text;
  v_old text := $old$and p.role = 'business_user'
          and (p_company_id is null or p.company_id = p_company_id)$old$;
  v_new text := $new$and p.role = 'business_user'
          and public.business_access() = 'verified'
          and (p_company_id is null or p.company_id = p_company_id)$new$;
begin
  v_def := pg_get_functiondef('public.portal_unit_price(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure);
  if position('public.business_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'portal_unit_price: business gate anchor missing. Apply 20261027_portal_business_separation.sql first.';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

comment on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) is
  'Sell price for store, business, or corporate. Business prices require business_access() = verified. Microsite callers cannot read business prices.';

-- business_submit_rfq: the verified check must run before the idempotent return.
do $patch$
declare
  v_def text;
  v_old text := $old$if not public.is_business() or v_company is null then
    raise exception 'Only a business account can submit this request';
  end if;$old$;
  v_new text := $new$if public.business_access() is distinct from 'verified' then
    if public.business_access() = 'pending' then
      raise exception 'Your account is pending approval';
    end if;
    raise exception 'Only an approved business account can submit this request';
  end if;
  if v_company is null then
    raise exception 'Only a business account can submit this request';
  end if;$new$;
begin
  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  if position('public.business_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'business_submit_rfq: access anchor missing';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

-- business_respond_quotation: same approval gate. Accept, reject, and revise stay as they are.
do $patch$
declare
  v_def text;
  v_old text := $old$if not public.is_business() or v_company is null then
    raise exception 'Only a business account can respond to this quotation';
  end if;$old$;
  v_new text := $new$if public.business_access() is distinct from 'verified' then
    if public.business_access() = 'pending' then
      raise exception 'Your account is pending approval';
    end if;
    raise exception 'Only an approved business account can respond to this quotation';
  end if;
  if v_company is null then
    raise exception 'Only a business account can respond to this quotation';
  end if;$new$;
begin
  v_def := pg_get_functiondef('public.business_respond_quotation(uuid,text,text,uuid[])'::regprocedure);
  if position('public.business_access()' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'business_respond_quotation: access anchor missing';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

commit;
