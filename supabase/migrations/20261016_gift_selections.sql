-- Employee gift selection campaigns on a company microsite.
-- One locked submission per employee per campaign. Staff can read all and reset (delete).
-- Apply after 20261016_gift_employee_role.sql has committed.
-- Do not apply from the agent. Deliver for ops.
-- Rollback: supabase/rollbacks/20261016_gift_selections_rollback.sql

begin;

create or replace function public.is_gift_staff()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role in ('admin', 'sales', 'operations', 'management')
  );
$$;

create or replace function public.is_gift_employee()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and p.role = 'gift_employee'
  );
$$;

-- Consumer domains are refused even when a campaign lists them.
create or replace function public.gift_email_domain_ok(p_email text, p_allowed text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    split_part(lower(btrim(coalesce(p_email, ''))), '@', 2) <> ''
    and not (
      split_part(lower(btrim(coalesce(p_email, ''))), '@', 2) = any (array[
        'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com',
        'outlook.com', 'live.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me',
        'protonmail.com', 'zoho.com', 'yandex.com', 'gmx.com', 'mail.com', 'rediffmail.com',
        'mailinator.com', 'guerrillamail.com', 'tempmail.com', '10minutemail.com', 'yopmail.com'
      ])
    )
    and split_part(lower(btrim(coalesce(p_email, ''))), '@', 2) = any (
      select lower(btrim(domain))
      from unnest(coalesce(p_allowed, '{}'::text[])) as domain
      where btrim(domain) <> ''
    );
$$;

revoke all on function public.is_gift_staff() from public;
revoke all on function public.is_gift_employee() from public;
revoke all on function public.gift_email_domain_ok(text, text[]) from public;
grant execute on function public.is_gift_staff() to authenticated;
grant execute on function public.is_gift_employee() to authenticated;
grant execute on function public.gift_email_domain_ok(text, text[]) to authenticated;

create table if not exists public.gift_selections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  allowed_email_domains text[] not null default '{}',
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint gift_selections_name_check check (char_length(btrim(name)) > 0),
  constraint gift_selections_dates_check check (closes_at > opens_at)
);

create table if not exists public.gift_selection_items (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.gift_selections (id) on delete cascade,
  kind text not null,
  product_id uuid references public.products (id) on delete restrict,
  title text not null,
  image_url text,
  member_names text[] not null default '{}',
  size_options text[] not null default '{}',
  sort_order integer not null default 0,
  constraint gift_selection_items_kind_check check (kind in ('product', 'combo')),
  constraint gift_selection_items_product_check check (
    (kind = 'product' and product_id is not null) or kind = 'combo'
  )
);

create table if not exists public.gift_selection_combo_products (
  item_id uuid not null references public.gift_selection_items (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  sort_order integer not null default 0,
  primary key (item_id, product_id)
);

create table if not exists public.gift_selection_submissions (
  id uuid primary key default gen_random_uuid(),
  selection_id uuid not null references public.gift_selections (id) on delete cascade,
  employee_user_id uuid not null references public.profiles (id) on delete cascade,
  employee_email text not null,
  employee_name text not null,
  phone text not null,
  address text not null,
  city text not null,
  state text not null,
  pin text not null,
  item_id uuid not null references public.gift_selection_items (id) on delete restrict,
  size text,
  selected_label text not null,
  submitted_at timestamptz not null default now(),
  constraint gift_selection_submissions_phone_check check (phone ~ '^[0-9]{10}$'),
  constraint gift_selection_submissions_pin_check check (pin ~ '^[0-9]{6}$'),
  constraint gift_selection_submissions_one_per_employee unique (selection_id, employee_user_id)
);

create index if not exists gift_selections_company_idx on public.gift_selections (company_id);
create index if not exists gift_selection_items_selection_idx on public.gift_selection_items (selection_id, sort_order);
create index if not exists gift_selection_submissions_selection_idx on public.gift_selection_submissions (selection_id);

comment on table public.gift_selections is
  'Employee gift campaign for one company. Employees on that company microsite pick exactly one item.';
comment on table public.gift_selection_submissions is
  'One locked choice per employee per campaign. Employees cannot update. Staff reset by deleting the row.';

create or replace function public.gift_submission_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles%rowtype;
  sel public.gift_selections%rowtype;
  item public.gift_selection_items%rowtype;
begin
  if tg_op = 'UPDATE' then
    raise exception 'Gift choice is locked';
  end if;

  select * into prof
  from public.profiles
  where id = auth.uid()
    and is_active = true
    and role = 'gift_employee';

  if prof.id is null or new.employee_user_id is distinct from auth.uid() then
    raise exception 'Only the signed-in employee can submit';
  end if;
  if prof.company_id is null then
    raise exception 'Employee is not linked to a company';
  end if;

  select * into sel from public.gift_selections where id = new.selection_id;
  if sel.id is null or sel.company_id is distinct from prof.company_id then
    raise exception 'This gift selection is not open for your company';
  end if;
  if now() < sel.opens_at or now() > sel.closes_at then
    raise exception 'This gift selection is closed';
  end if;
  if not public.gift_email_domain_ok(prof.email, sel.allowed_email_domains) then
    raise exception 'Use your company email address';
  end if;

  if char_length(btrim(coalesce(new.employee_name, ''))) = 0 then
    raise exception 'Name is required';
  end if;
  if new.phone !~ '^[0-9]{10}$' then
    raise exception 'Phone must be 10 digits';
  end if;
  if new.pin !~ '^[0-9]{6}$' then
    raise exception 'PIN must be 6 digits';
  end if;
  if char_length(btrim(coalesce(new.address, ''))) = 0
     or char_length(btrim(coalesce(new.city, ''))) = 0
     or char_length(btrim(coalesce(new.state, ''))) = 0 then
    raise exception 'Address, city and state are required';
  end if;

  select * into item
  from public.gift_selection_items
  where id = new.item_id
    and selection_id = new.selection_id;
  if item.id is null then
    raise exception 'Choose one gift from the list';
  end if;
  if coalesce(cardinality(item.size_options), 0) > 0 then
    if new.size is null or not (new.size = any (item.size_options)) then
      raise exception 'Choose a size';
    end if;
  else
    new.size := null;
  end if;

  new.employee_email := lower(prof.email);
  new.employee_name := btrim(new.employee_name);
  new.address := btrim(new.address);
  new.city := btrim(new.city);
  new.state := btrim(new.state);
  new.selected_label := item.title;
  new.submitted_at := now();
  return new;
end;
$$;

revoke all on function public.gift_submission_guard() from public;
revoke all on function public.gift_submission_guard() from anon;
revoke all on function public.gift_submission_guard() from authenticated;

drop trigger if exists gift_submission_guard on public.gift_selection_submissions;
create trigger gift_submission_guard
  before insert or update on public.gift_selection_submissions
  for each row execute function public.gift_submission_guard();

alter table public.gift_selections enable row level security;
alter table public.gift_selection_items enable row level security;
alter table public.gift_selection_combo_products enable row level security;
alter table public.gift_selection_submissions enable row level security;

revoke all on public.gift_selections from anon;
revoke all on public.gift_selection_items from anon;
revoke all on public.gift_selection_combo_products from anon;
revoke all on public.gift_selection_submissions from anon;
revoke all on public.gift_selections from authenticated;
revoke all on public.gift_selection_items from authenticated;
revoke all on public.gift_selection_combo_products from authenticated;
revoke all on public.gift_selection_submissions from authenticated;

grant select, insert, update, delete on public.gift_selections to authenticated;
grant select, insert, update, delete on public.gift_selection_items to authenticated;
grant select, insert, update, delete on public.gift_selection_combo_products to authenticated;
grant select, insert, delete on public.gift_selection_submissions to authenticated;

drop policy if exists gift_selections_staff_all on public.gift_selections;
create policy gift_selections_staff_all
  on public.gift_selections
  for all
  using (public.is_gift_staff())
  with check (public.is_gift_staff());

drop policy if exists gift_selections_employee_select on public.gift_selections;
create policy gift_selections_employee_select
  on public.gift_selections
  for select
  using (
    public.is_gift_employee()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.company_id = gift_selections.company_id
        and public.gift_email_domain_ok(p.email, gift_selections.allowed_email_domains)
    )
    and (
      (now() >= gift_selections.opens_at and now() <= gift_selections.closes_at)
      or exists (
        select 1
        from public.gift_selection_submissions s
        where s.selection_id = gift_selections.id
          and s.employee_user_id = auth.uid()
      )
    )
  );

drop policy if exists gift_items_staff_all on public.gift_selection_items;
create policy gift_items_staff_all
  on public.gift_selection_items
  for all
  using (public.is_gift_staff())
  with check (public.is_gift_staff());

drop policy if exists gift_items_employee_select on public.gift_selection_items;
create policy gift_items_employee_select
  on public.gift_selection_items
  for select
  using (
    exists (
      select 1
      from public.gift_selections g
      where g.id = gift_selection_items.selection_id
    )
  );

drop policy if exists gift_combo_staff_all on public.gift_selection_combo_products;
create policy gift_combo_staff_all
  on public.gift_selection_combo_products
  for all
  using (public.is_gift_staff())
  with check (public.is_gift_staff());

drop policy if exists gift_combo_employee_select on public.gift_selection_combo_products;
create policy gift_combo_employee_select
  on public.gift_selection_combo_products
  for select
  using (
    exists (
      select 1
      from public.gift_selection_items i
      where i.id = gift_selection_combo_products.item_id
    )
  );

drop policy if exists gift_submissions_staff_select on public.gift_selection_submissions;
create policy gift_submissions_staff_select
  on public.gift_selection_submissions
  for select
  using (public.is_gift_staff());

drop policy if exists gift_submissions_staff_delete on public.gift_selection_submissions;
create policy gift_submissions_staff_delete
  on public.gift_selection_submissions
  for delete
  using (public.is_gift_staff());

drop policy if exists gift_submissions_employee_select on public.gift_selection_submissions;
create policy gift_submissions_employee_select
  on public.gift_selection_submissions
  for select
  using (public.is_gift_employee() and employee_user_id = auth.uid());

drop policy if exists gift_submissions_employee_insert on public.gift_selection_submissions;
create policy gift_submissions_employee_insert
  on public.gift_selection_submissions
  for insert
  with check (public.is_gift_employee() and employee_user_id = auth.uid());

commit;
