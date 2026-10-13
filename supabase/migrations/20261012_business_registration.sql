-- Business self-registration: default owner, rate limiter, and the account RPC.
-- register_business_account never looks up a company by name.
-- Both functions are service_role only.

alter table public.org_settings
  add column if not exists business_default_owner_id uuid references public.profiles (id);

comment on column public.org_settings.business_default_owner_id is
  'Account manager assigned to a new business company. Null falls through to the first active admin.';

create table if not exists public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

alter table public.rate_limit_hits enable row level security;
revoke all on table public.rate_limit_hits from public, anon, authenticated;
grant all on table public.rate_limit_hits to service_role;

create or replace function public.hit_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_window timestamptz;
  v_hits integer;
begin
  if not v_service then
    raise exception 'Not permitted';
  end if;
  if p_key is null or length(btrim(p_key)) = 0 or p_window_seconds < 1 or p_max < 1 then
    return false;
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limit_hits as h (key, window_start, hits)
  values (left(btrim(p_key), 200), v_window, 1)
  on conflict (key, window_start) do update
    set hits = h.hits + 1
  returning hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

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
    nullif(btrim(coalesce(p_company->>'gst_number', '')), ''),
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
  'Creates a prospect business company, a business contact, and a cold lead. Never matches an existing company by name.';
