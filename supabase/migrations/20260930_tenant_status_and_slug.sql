-- Portal access status (separate from CRM sales status), subdomain provisioning,
-- portal_slug format, and slug_history so released/old slugs stay reserved.
-- Idempotent. Do not apply via MCP unless explicitly requested.
-- companies.status (prospect|active|inactive) is left untouched.

-- ---------------------------------------------------------------------------
-- 1. portal_status + trial_ends_at
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists portal_status text;

alter table public.companies
  add column if not exists trial_ends_at timestamptz;

update public.companies
set portal_status = 'active'
where portal_status is null;

alter table public.companies
  alter column portal_status set default 'active';

alter table public.companies
  alter column portal_status set not null;

alter table public.companies drop constraint if exists companies_portal_status_check;

alter table public.companies
  add constraint companies_portal_status_check
  check (portal_status in ('trial', 'active', 'suspended', 'cancelled'));

comment on column public.companies.portal_status is
  'Portal access lifecycle: trial|active|suspended|cancelled. Independent of CRM sales status.';
comment on column public.companies.trial_ends_at is
  'When portal_status=trial, portal access ends after this timestamp.';

-- ---------------------------------------------------------------------------
-- 2. Subdomain provisioning columns
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists subdomain_status text;

alter table public.companies
  add column if not exists subdomain_attempts integer;

alter table public.companies
  add column if not exists subdomain_last_error text;

alter table public.companies
  add column if not exists subdomain_updated_at timestamptz;

update public.companies
set subdomain_status = 'none'
where subdomain_status is null;

update public.companies
set subdomain_attempts = 0
where subdomain_attempts is null;

alter table public.companies
  alter column subdomain_status set default 'none';

alter table public.companies
  alter column subdomain_attempts set default 0;

alter table public.companies drop constraint if exists companies_subdomain_status_check;

alter table public.companies
  add constraint companies_subdomain_status_check
  check (subdomain_status in ('none', 'pending', 'provisioning', 'ssl_pending', 'live', 'failed'));

comment on column public.companies.subdomain_status is
  'Hostinger subdomain provisioning state for portal_slug.';
comment on column public.companies.subdomain_attempts is
  'Number of subdomain provisioning attempts.';
comment on column public.companies.subdomain_last_error is
  'Last subdomain provisioning error message.';
comment on column public.companies.subdomain_updated_at is
  'When subdomain provisioning fields last changed.';

-- ---------------------------------------------------------------------------
-- 3. portal_slug format: lowercase a-z0-9-, 3–40 chars, no leading/trailing hyphen
-- ---------------------------------------------------------------------------
update public.companies
set portal_slug = null
where portal_slug is not null
  and (
    char_length(portal_slug) < 3
    or char_length(portal_slug) > 40
    or portal_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'
  );

alter table public.companies drop constraint if exists companies_portal_slug_format_check;

alter table public.companies
  add constraint companies_portal_slug_format_check
  check (
    portal_slug is null
    or (
      char_length(portal_slug) between 3 and 40
      and portal_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'
    )
  );

-- ---------------------------------------------------------------------------
-- 4. slug_history — old/released slugs reserved for 30 days after release
-- ---------------------------------------------------------------------------
create table if not exists public.slug_history (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  company_id uuid references public.companies(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  constraint slug_history_slug_format_check check (
    char_length(slug) between 3 and 40
    and slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$'
  )
);

create unique index if not exists slug_history_slug_key
  on public.slug_history (slug);

comment on table public.slug_history is
  'Previously used portal slugs. Rows with released_at null or within 30 days remain reserved.';

alter table public.slug_history enable row level security;

drop policy if exists slug_history_select on public.slug_history;
create policy slug_history_select on public.slug_history
  for select using (
    public.can_management_read()
    or public.can_ops()
    or public.can_finance()
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'sales')
    )
  );

drop policy if exists slug_history_insert on public.slug_history;
create policy slug_history_insert on public.slug_history
  for insert with check (
    public.is_admin()
    or public.can_crm()
  );

drop policy if exists slug_history_update on public.slug_history;
create policy slug_history_update on public.slug_history
  for update
  using (public.is_admin() or public.can_crm())
  with check (public.is_admin() or public.can_crm());

drop policy if exists slug_history_delete on public.slug_history;
create policy slug_history_delete on public.slug_history
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Trigger: on portal_slug change/clear, record the old slug
-- ---------------------------------------------------------------------------
create or replace function public.companies_record_slug_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.portal_slug is not null
     and old.portal_slug is distinct from new.portal_slug then
    insert into public.slug_history (slug, company_id, released_at, created_at)
    values (old.portal_slug, old.id, now(), now())
    on conflict (slug) do update
      set company_id = excluded.company_id,
          released_at = excluded.released_at,
          created_at = excluded.created_at;
  end if;
  return new;
end;
$$;

drop trigger if exists companies_portal_slug_history on public.companies;
create trigger companies_portal_slug_history
  after update of portal_slug on public.companies
  for each row
  execute function public.companies_record_slug_history();
