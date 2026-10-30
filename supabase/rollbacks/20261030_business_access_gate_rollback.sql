-- Removes the verified-business gate from portal_unit_price, business_submit_rfq,
-- and business_respond_quotation, then drops public.business_access().
-- Restores the 20261027 price permission and the previous RPC role checks.
-- Do not apply from the agent. Run this before rolling back 20261027.

begin;

do $patch$
declare
  v_def text;
  v_new text := $new$and p.role = 'business_user'
          and public.business_access() = 'verified'
          and (p_company_id is null or p.company_id = p_company_id)$new$;
  v_old text := $old$and p.role = 'business_user'
          and (p_company_id is null or p.company_id = p_company_id)$old$;
begin
  v_def := pg_get_functiondef('public.portal_unit_price(text,uuid,uuid,numeric,numeric,numeric,numeric,numeric)'::regprocedure);
  if position(v_new in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

comment on function public.portal_unit_price(text, uuid, uuid, numeric, numeric, numeric, numeric, numeric) is
  'Sell price for store, business, or corporate. Business callers cannot read corporate prices, and microsite callers cannot read business prices.';

do $patch$
declare
  v_def text;
  v_new text := $new$if public.business_access() is distinct from 'verified' then
    if public.business_access() = 'pending' then
      raise exception 'Your account is pending approval';
    end if;
    raise exception 'Only an approved business account can submit this request';
  end if;
  if v_company is null then
    raise exception 'Only a business account can submit this request';
  end if;$new$;
  v_old text := $old$if not public.is_business() or v_company is null then
    raise exception 'Only a business account can submit this request';
  end if;$old$;
begin
  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  if position(v_new in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

do $patch$
declare
  v_def text;
  v_new text := $new$if public.business_access() is distinct from 'verified' then
    if public.business_access() = 'pending' then
      raise exception 'Your account is pending approval';
    end if;
    raise exception 'Only an approved business account can respond to this quotation';
  end if;
  if v_company is null then
    raise exception 'Only a business account can respond to this quotation';
  end if;$new$;
  v_old text := $old$if not public.is_business() or v_company is null then
    raise exception 'Only a business account can respond to this quotation';
  end if;$old$;
begin
  v_def := pg_get_functiondef('public.business_respond_quotation(uuid,text,text,uuid[])'::regprocedure);
  if position(v_new in v_def) > 0 then
    execute replace(v_def, v_new, v_old);
  end if;
end;
$patch$;

drop function if exists public.business_access();

commit;
