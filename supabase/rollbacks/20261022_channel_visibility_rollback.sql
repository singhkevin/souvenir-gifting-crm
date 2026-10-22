-- Rollback for 20261022_channel_visibility.sql.
-- Restores catalogue_access = 'all' as the store and business rule, then drops the
-- channel columns. Products whose Retail or Business switch was changed after the
-- migration go back to following corporate "All companies".

begin;

do $patch$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.place_direct_order(uuid,uuid,uuid,text,uuid,jsonb,text)'::regprocedure);
  v_def := replace(v_def, $n$if v_product.status <> 'active' or not (
        case when v_source = 'business'
          then coalesce(v_product.show_in_business, v_product.catalogue_access = 'all')
          else coalesce(v_product.show_in_store, v_product.catalogue_access = 'all')
        end
      ) then$n$, $o$if v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'place_direct_order still references the channel columns';
  end if;
  execute v_def;

  v_def := pg_get_functiondef('public.business_submit_rfq(text,jsonb,date,text,numeric,text,text)'::regprocedure);
  v_def := replace(v_def, $n$if not found or v_product.status <> 'active'
       or not coalesce(v_product.show_in_business, v_product.catalogue_access = 'all') then$n$,
    $o$if not found or v_product.status <> 'active' or v_product.catalogue_access <> 'all' then$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'business_submit_rfq still references the channel columns';
  end if;
  execute v_def;

  v_def := pg_get_functiondef('public.convert_quotation_to_order(uuid)'::regprocedure);
  v_def := replace(v_def,
    $n$(coalesce(p.catalogue_access, 'all') <> 'none' or coalesce(p.show_in_store, false) or coalesce(p.show_in_business, false))$n$,
    $o$coalesce(p.catalogue_access, 'all') <> 'none'$o$);
  if position('show_in_' in v_def) > 0 then
    raise exception 'convert_quotation_to_order still references the channel columns';
  end if;
  execute v_def;
end;
$patch$;

drop policy if exists products_store_select on public.products;
drop policy if exists products_business_select on public.products;

-- Original body, verbatim.
create or replace function public.protect_catalogue_access()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.catalogue_access IS DISTINCT FROM OLD.catalogue_access
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
  ) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Only admin can change product catalogue visibility';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

comment on column public.products.catalogue_access is null;

drop index if exists public.products_show_in_store_idx;
drop index if exists public.products_show_in_business_idx;

alter table public.products
  drop column if exists show_in_store,
  drop column if exists show_in_business;

commit;
