-- Work-email rules for business accounts.
-- Blocks free and disposable domains on insert, and when the email or role changes.
-- Existing business accounts on a blocked domain keep working. Staff review them
-- in business_free_email_review. Do not auto-block those rows.
-- Allow rules mirror email_domain_allowlist. Do not apply from the agent.

begin;

create table if not exists public.email_domain_rules (
  domain text primary key,
  rule text not null,
  note text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint email_domain_rules_rule_check check (rule in ('block_free', 'block_disposable', 'allow'))
);

comment on table public.email_domain_rules is
  'Business email policy. allow wins over a block. Unknown domains are work emails. Existing accounts are not updated by this table.';

alter table public.email_domain_rules enable row level security;

drop policy if exists email_domain_rules_staff_select on public.email_domain_rules;
create policy email_domain_rules_staff_select
  on public.email_domain_rules
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active
        and p.role in ('admin', 'sales', 'management')
    )
  );

drop policy if exists email_domain_rules_admin_write on public.email_domain_rules;
create policy email_domain_rules_admin_write
  on public.email_domain_rules
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin' and p.is_active
    )
  );

grant select, insert, update, delete on public.email_domain_rules to authenticated;
grant all on public.email_domain_rules to service_role;

-- Seeded from src/lib/business/email-domain.ts. on conflict do nothing so a later
-- admin change is kept if this file is applied twice.
insert into public.email_domain_rules (domain, rule, note) values
  ('gmail.com', 'block_free', 'Seeded from the app free-email list'),
  ('googlemail.com', 'block_free', 'Seeded from the app free-email list'),
  ('yahoo.com', 'block_free', 'Seeded from the app free-email list'),
  ('yahoo.co.in', 'block_free', 'Seeded from the app free-email list'),
  ('yahoo.in', 'block_free', 'Seeded from the app free-email list'),
  ('hotmail.com', 'block_free', 'Seeded from the app free-email list'),
  ('hotmail.co.uk', 'block_free', 'Seeded from the app free-email list'),
  ('outlook.com', 'block_free', 'Seeded from the app free-email list'),
  ('outlook.co.in', 'block_free', 'Seeded from the app free-email list'),
  ('live.com', 'block_free', 'Seeded from the app free-email list'),
  ('live.in', 'block_free', 'Seeded from the app free-email list'),
  ('msn.com', 'block_free', 'Seeded from the app free-email list'),
  ('aol.com', 'block_free', 'Seeded from the app free-email list'),
  ('icloud.com', 'block_free', 'Seeded from the app free-email list'),
  ('me.com', 'block_free', 'Seeded from the app free-email list'),
  ('proton.me', 'block_free', 'Seeded from the app free-email list'),
  ('protonmail.com', 'block_free', 'Seeded from the app free-email list'),
  ('zoho.com', 'block_free', 'Seeded from the app free-email list'),
  ('yandex.com', 'block_free', 'Seeded from the app free-email list'),
  ('gmx.com', 'block_free', 'Seeded from the app free-email list'),
  ('mail.com', 'block_free', 'Seeded from the app free-email list'),
  ('rediffmail.com', 'block_free', 'Seeded from the app free-email list'),
  ('mailinator.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('guerrillamail.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('tempmail.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('10minutemail.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('yopmail.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('trashmail.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('sharklasers.com', 'block_disposable', 'Seeded from the app disposable-email list'),
  ('dispostable.com', 'block_disposable', 'Seeded from the app disposable-email list')
on conflict (domain) do nothing;

-- An existing allowlist row is an admin exception and wins over the seed block.
insert into public.email_domain_rules (domain, rule, note)
select a.domain, 'allow', a.note
from public.email_domain_allowlist a
on conflict (domain) do update
  set rule = 'allow',
      note = excluded.note;

create or replace function public.email_domain_of(p_email text)
returns text
language sql
immutable
as $$
  select case
    when p_email is null or position('@' in p_email) = 0 then null
    when domain = '' or position('.' in domain) = 0 or domain ~ '\s' then null
    else domain
  end
  from (
    select lower(regexp_replace(btrim(split_part(p_email, '@', 2)), '^www\.', '')) as domain
  ) parsed;
$$;

create or replace function public.is_work_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.email_domain_of(p_email) is null then false
    when exists (
      select 1 from public.email_domain_rules r
      where r.domain = public.email_domain_of(p_email)
        and r.rule = 'allow'
    ) then true
    when exists (
      select 1 from public.email_domain_rules r
      where r.domain = public.email_domain_of(p_email)
        and r.rule in ('block_free', 'block_disposable')
    ) then false
    else true
  end;
$$;

comment on function public.is_work_email(text) is
  'True for a work email. Allow overrides a block. Unknown domains are allowed. A blank or invalid email is not.';

revoke all on function public.email_domain_of(text) from public;
revoke all on function public.is_work_email(text) from public, anon;
grant execute on function public.email_domain_of(text) to authenticated, service_role;
grant execute on function public.is_work_email(text) to authenticated, service_role;

create or replace function public.sync_allowlist_from_email_rule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    if old.rule = 'allow' then
      delete from public.email_domain_allowlist where domain = old.domain;
    end if;
    return old;
  end if;
  if new.rule = 'allow' then
    insert into public.email_domain_allowlist (domain, note)
    values (new.domain, new.note)
    on conflict (domain) do update set note = excluded.note;
  else
    delete from public.email_domain_allowlist where domain = new.domain;
  end if;
  return new;
end;
$$;

create or replace function public.sync_email_rule_from_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    delete from public.email_domain_rules
    where domain = old.domain
      and rule = 'allow';
    return old;
  end if;
  insert into public.email_domain_rules (domain, rule, note)
  values (new.domain, 'allow', new.note)
  on conflict (domain) do update
    set rule = 'allow',
        note = excluded.note;
  return new;
end;
$$;

revoke all on function public.sync_allowlist_from_email_rule() from public, anon;
revoke all on function public.sync_email_rule_from_allowlist() from public, anon;

drop trigger if exists email_domain_rules_sync_allowlist on public.email_domain_rules;
create trigger email_domain_rules_sync_allowlist
  after insert or update or delete
  on public.email_domain_rules
  for each row
  execute function public.sync_allowlist_from_email_rule();

drop trigger if exists email_domain_allowlist_sync_rules on public.email_domain_allowlist;
create trigger email_domain_allowlist_sync_rules
  after insert or update or delete
  on public.email_domain_allowlist
  for each row
  execute function public.sync_email_rule_from_allowlist();

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

revoke all on function public.enforce_business_email_domain() from public, anon;
grant execute on function public.enforce_business_email_domain() to authenticated, service_role;

drop trigger if exists profiles_enforce_business_email_domain on public.profiles;
create trigger profiles_enforce_business_email_domain
  before insert or update of role, email
  on public.profiles
  for each row
  execute function public.enforce_business_email_domain();

-- Report only. These accounts are not blocked.
create or replace view public.business_free_email_review
with (security_invoker = true) as
select
  p.id as profile_id,
  p.email,
  p.company_id,
  c.name as company_name,
  c.business_verification,
  c.owner_id,
  public.email_domain_of(p.email) as domain,
  r.rule
from public.profiles p
join public.companies c
  on c.id = p.company_id
 and c.account_type = 'business'
join public.email_domain_rules r
  on r.domain = public.email_domain_of(p.email)
 and r.rule in ('block_free', 'block_disposable')
where p.role = 'business_user';

comment on view public.business_free_email_review is
  'Business logins still on a blocked free or disposable domain. They keep working. Staff review them. Do not auto-block.';

revoke all on public.business_free_email_review from public, anon;
grant select on public.business_free_email_review to authenticated, service_role;

-- Registration uses the same function as the profile trigger. The GSTIN rules stay as they are.
do $patch$
declare
  v_def text;
  v_old text := $old$if split_part(v_email, '@', 2) = any (array[
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
  end if;$old$;
  v_new text := $new$if not public.is_work_email(v_email) then
    raise exception 'work email required';
  end if;$new$;
begin
  v_def := pg_get_functiondef('public.register_business_account(jsonb,jsonb)'::regprocedure);
  if position('public.is_work_email(v_email)' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'register_business_account: work-email anchor missing';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

commit;
