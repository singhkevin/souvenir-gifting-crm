-- GSTIN is optional on business registration. Format, state code, and check digit
-- are checked only when a number is provided. Work-email gating is unchanged.
-- Replaces register_business_account from 20261018_registration_pricing_samples.sql.
-- Do not edit that file. Do not apply from the agent.

begin;

create or replace function public.register_business_account(
  p_company jsonb,
  p_contact jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_owner uuid;
  v_company_id uuid;
  v_contact_id uuid;
  v_name text;
  v_contact_name text;
  v_email text;
  v_gst text;
  v_factor int;
  v_sum int;
  v_i int;
  v_code int;
  v_digit int;
begin
  if not v_service then
    raise exception 'Not permitted';
  end if;

  v_name := nullif(btrim(coalesce(p_company->>'legal_name', '')), '');
  v_contact_name := nullif(btrim(coalesce(p_contact->>'full_name', '')), '');
  v_email := nullif(lower(btrim(coalesce(p_contact->>'email', ''))), '');
  if v_name is null or v_contact_name is null or v_email is null or position('@' in v_email) < 2 then
    raise exception 'A legal name, contact name, and email are required';
  end if;

  v_gst := nullif(upper(regexp_replace(coalesce(p_company->>'gst_number', ''), '\s', '', 'g')), '');
  if v_gst is not null then
    if v_gst !~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
       or left(v_gst, 2) <> all (array[
         '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
         '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
         '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
         '31', '32', '33', '34', '35', '36', '37', '38'
       ]) then
      raise exception 'invalid GSTIN';
    end if;

    -- Same check digit as src/lib/business/gstin.ts (mod 36, factor 2 then 1).
    v_factor := 2;
    v_sum := 0;
    for v_i in reverse 14..1 loop
      v_code := position(substr(v_gst, v_i, 1) in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') - 1;
      v_digit := v_factor * v_code;
      v_factor := case when v_factor = 2 then 1 else 2 end;
      v_digit := (v_digit / 36) + (v_digit % 36);
      v_sum := v_sum + v_digit;
    end loop;
    if substr(v_gst, 15, 1) is distinct from substr(
      '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ((36 - (v_sum % 36)) % 36) + 1,
      1
    ) then
      raise exception 'invalid GSTIN';
    end if;
  end if;

  if split_part(v_email, '@', 2) = any (array[
      'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com',
      'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
      'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
      'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com',
      'yopmail.com', 'trashmail.com', 'sharklasers.com', 'dispostable.com'
    ])
    and not exists (
      select 1 from public.email_domain_allowlist a
      where a.domain = split_part(v_email, '@', 2)
    )
  then
    raise exception 'work email required';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email)
     or exists (select 1 from public.profiles p where lower(p.email) = v_email)
     or exists (select 1 from public.contacts c where lower(c.email) = v_email) then
    raise exception 'email already registered';
  end if;

  select s.business_default_owner_id
    into v_owner
  from public.org_settings s
  join public.profiles p on p.id = s.business_default_owner_id and p.is_active
  limit 1;

  if v_owner is null then
    select id
      into v_owner
    from public.profiles
    where role = 'admin'
      and is_active
    order by created_at
    limit 1;
  end if;

  if v_owner is null then
    raise exception 'No account owner is available for a business account';
  end if;

  insert into public.companies (
    name,
    status,
    account_type,
    business_verification,
    owner_id,
    gst_number,
    city,
    state,
    country,
    website,
    notes
  ) values (
    left(v_name, 200),
    'prospect',
    'business',
    'unverified',
    v_owner,
    v_gst,
    nullif(btrim(coalesce(p_company->>'city', '')), ''),
    nullif(btrim(coalesce(p_company->>'state', '')), ''),
    coalesce(nullif(btrim(coalesce(p_company->>'country', '')), ''), 'India'),
    nullif(btrim(coalesce(p_company->>'website', '')), ''),
    nullif(btrim(coalesce(p_company->>'notes', '')), '')
  )
  returning id into v_company_id;

  insert into public.contacts (
    company_id,
    full_name,
    email,
    phone,
    contact_type,
    kind,
    notes
  ) values (
    v_company_id,
    left(v_contact_name, 200),
    v_email,
    nullif(btrim(coalesce(p_contact->>'phone', '')), ''),
    'primary',
    'business',
    'Registered a business account.'
  )
  returning id into v_contact_id;

  insert into public.leads (
    company_id,
    contact_id,
    owner_id,
    source,
    stage,
    notes
  ) values (
    v_company_id,
    v_contact_id,
    v_owner,
    'website',
    'cold',
    'Opened from business self-registration.'
  );

  return v_company_id;
end;
$$;

revoke all on function public.register_business_account(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.register_business_account(jsonb, jsonb) to service_role;

comment on function public.register_business_account(jsonb, jsonb) is
  'Creates a prospect business company. Requires a work email. GSTIN is optional; a provided GSTIN must match the format and check digit. Free inboxes need email_domain_allowlist.';

commit;
