begin;

drop function if exists public.presentation_public(text);
drop table if exists public.presentation_links;
drop table if exists public.presentation_combo_products;
drop table if exists public.presentation_items;
drop table if exists public.presentations;
drop function if exists public.is_presentation_staff();

commit;
