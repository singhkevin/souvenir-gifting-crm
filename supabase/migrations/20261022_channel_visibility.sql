-- Per-channel product visibility: Retail store, Business portal, Corporate.
-- Apply after 20261021_pricing_engine.sql (and after 20261022_channel_order_visibility.sql
-- when that one is applied; if it is applied later, re-run this file: every step is
-- idempotent). Do not apply from the agent.
--
-- Before: the public store and the business portal showed only catalogue_access = 'all',
-- so "Selected companies" or "Not in client catalogues" also hid a product from retail.
-- After: products.show_in_store and products.show_in_business are independent switches.
-- catalogue_access keeps meaning corporate visibility only (/portal, client catalogues,
-- microsites, shared catalog links), with company_product_access and exclusions unchanged.
--
-- Backfill = current effective visibility: show_in_store = show_in_business =
-- (catalogue_access = 'all'). No product appears or disappears on any channel.
--
-- Function changes are text patches of the live definitions, so whichever body of
-- place_direct_order is live (pricing engine, or channel order visibility) is kept:
--   place_direct_order   store surface checks show_in_store, or show_in_business for
--                        source 'business', instead of catalogue_access = 'all'
--   business_submit_rfq  checks show_in_business instead of catalogue_access = 'all'
--   convert_quotation_to_order  a retail or business product with corporate 'none'
--                        can still be converted from a quotation
-- Each patch must match exactly once or the migration fails and nothing changes.

begin;

alter table public.products
  add column if not exists show_in_store boolean,
  add column if not exists show_in_business boolean;

-- Backfill only rows not set yet, without touching updated_at.
alter table public.products disable trigger products_updated_at;
update public.products
set show_in_store = coalesce(show_in_store, catalogue_access = 'all'),
    show_in_business = coalesce(show_in_business, catalogue_access = 'all')
where show_in_store is null or show_in_business is null;
alter table public.products enable trigger products_updated_at;

alter table public.products
  alter column show_in_store set default true,
  alter column show_in_store set not null,
  alter column show_in_business set default true,
  alter column show_in_business set not null;

comment on column public.products.show_in_store is
  'Retail store switch: public store, /catalogue, search, homepage. Independent of catalogue_access.';
comment on column public.products.show_in_business is
  'Business portal switch: /business for registered non-corporate businesses. Independent of catalogue_access.';
comment on column public.products.catalogue_access is
  'Corporate visibility only: all / selected / none for /portal, client catalogues and microsites.';

create index if not exists products_show_in_store_idx on public.products (status) where show_in_store;
create index if not exists products_show_in_business_idx on public.products (status) where show_in_business;

-- Only admin may change any channel switch (same rule as catalogue_access).
create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.catalogue_access is distinct from old.catalogue_access
    or new.visibility is distinct from old.visibility
    or new.show_in_store is distinct from old.show_in_store
    or new.show_in_business is distinct from old.show_in_business
  ) then
    if not public.is_admin() then
      raise exception 'Only admin can change product catalogue visibility';
    end if;
  end if;
  return new;
end;
$$;

-- Read policies. products_public_catalogue_select (active + 'all') is unchanged, so
-- corporate clients read exactly what they read today.
drop policy if exists products_store_select on public.products;
create policy products_store_select on public.products
  for select to anon
  using (status = 'active' and show_in_store);

drop policy if exists products_business_select on public.products;
create policy products_business_select on public.products
  for select to authenticated
  using (status = 'active' and show_in_business and public.is_business());

-- Text patches of live function bodies.
do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
  v_hits integer;
begin
  -- place_direct_order: store surface
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  v_old := $o$if v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$;
  v_new := $n$if v_product.status <> 'active' or not (
        case when v_source = 'business'
          then coalesce(v_product.show_in_business, v_product.catalogue_access = 'all')
          else coalesce(v_product.show_in_store, v_product.catalogue_access = 'all')
        end
      ) then$n$;
  if position('v_product.show_in_store' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'place_direct_order: expected 1 store check, found %', v_hits;
    end if;
    if position('v_source := p_source' in v_def) = 0
       or position('v_source := p_source' in v_def) > position(v_old in v_def) then
      raise exception 'place_direct_order: v_source is not set before the line checks';
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- business_submit_rfq
  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  v_old := $o$if not found or v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$;
  v_new := $n$if not found or v_product.status <> 'active'
       or not coalesce(v_product.show_in_business, v_product.catalogue_access = 'all') then$n$;
  if position('v_product.show_in_business' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 1 then
      raise exception 'business_submit_rfq: expected 1 check, found %', v_hits;
    end if;
    execute replace(v_def, v_old, v_new);
  end if;

  -- convert_quotation_to_order
  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);
  v_old := $o$coalesce(p.catalogue_access, 'all') <> 'none'$o$;
  v_new := $n$(coalesce(p.catalogue_access, 'all') <> 'none' or coalesce(p.show_in_store, false) or coalesce(p.show_in_business, false))$n$;
  if position('p.show_in_store' in v_def) = 0 then
    v_hits := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
    if v_hits <> 3 then
      raise exception 'convert_quotation_to_order: expected 3 checks, found %', v_hits;
    end if;
    execute replace(v_def, v_old, v_new);
  end if;
end;
$patch$;

commit;
