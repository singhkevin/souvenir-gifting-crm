-- Pitch decks. Staff curate products and combos. Public links show sell price unless the deck hides prices.
-- Do not apply from the agent.

begin;

create or replace function public.is_presentation_staff()
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

revoke all on function public.is_presentation_staff() from public;
grant execute on function public.is_presentation_staff() to authenticated;

create table public.presentations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  client_name text not null,
  company_id uuid references public.companies (id) on delete set null,
  notes text not null default '',
  show_prices boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presentations_title_check check (char_length(btrim(title)) > 0),
  constraint presentations_client_check check (char_length(btrim(client_name)) > 0)
);

create table public.presentation_items (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations (id) on delete cascade,
  kind text not null,
  product_id uuid references public.products (id) on delete set null,
  title text not null,
  image_url text,
  specs text not null default '',
  price numeric(12, 2) not null,
  moq integer not null,
  member_names text[] not null default '{}',
  sort_order integer not null default 0,
  constraint presentation_items_kind_check check (kind in ('product', 'combo')),
  constraint presentation_items_price_check check (price >= 0),
  constraint presentation_items_moq_check check (moq >= 1)
);

create table public.presentation_combo_products (
  item_id uuid not null references public.presentation_items (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (item_id, product_id)
);

create table public.presentation_links (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint presentation_links_token_check check (char_length(token) between 16 and 80)
);

create unique index presentation_links_one_open
  on public.presentation_links (presentation_id)
  where revoked_at is null;

create index presentation_items_deck_idx on public.presentation_items (presentation_id, sort_order);

alter table public.presentations enable row level security;
alter table public.presentation_items enable row level security;
alter table public.presentation_combo_products enable row level security;
alter table public.presentation_links enable row level security;

create policy presentations_staff on public.presentations
  for all to authenticated
  using (public.is_presentation_staff())
  with check (public.is_presentation_staff());

create policy presentation_items_staff on public.presentation_items
  for all to authenticated
  using (public.is_presentation_staff())
  with check (public.is_presentation_staff());

create policy presentation_combo_staff on public.presentation_combo_products
  for all to authenticated
  using (public.is_presentation_staff())
  with check (public.is_presentation_staff());

create policy presentation_links_staff on public.presentation_links
  for all to authenticated
  using (public.is_presentation_staff())
  with check (public.is_presentation_staff());

revoke all on table public.presentations from anon, public;
revoke all on table public.presentation_items from anon, public;
revoke all on table public.presentation_combo_products from anon, public;
revoke all on table public.presentation_links from anon, public;

grant select, insert, update, delete on public.presentations to authenticated;
grant select, insert, update, delete on public.presentation_items to authenticated;
grant select, insert, update, delete on public.presentation_combo_products to authenticated;
grant select, insert, update, delete on public.presentation_links to authenticated;

-- Guest payload. Sell price is included unless the deck hides prices. Costs and margins are never read.
create or replace function public.presentation_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', p.title,
    'client_name', p.client_name,
    'notes', p.notes,
    'show_prices', p.show_prices,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'title', i.title,
          'image_url', i.image_url,
          'specs', i.specs,
          'moq', i.moq,
          'price', case when p.show_prices then i.price end,
          'kind', i.kind,
          'member_names', to_jsonb(i.member_names)
        )
        order by i.sort_order
      )
      from public.presentation_items i
      where i.presentation_id = p.id
    ), '[]'::jsonb)
  )
  from public.presentation_links l
  join public.presentations p on p.id = l.presentation_id
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now());
$$;

revoke all on function public.presentation_public(text) from public;
grant execute on function public.presentation_public(text) to anon, authenticated;

commit;
