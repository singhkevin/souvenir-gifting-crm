begin;

alter table public.products drop column if exists occasion_tags;
alter table public.brands drop column if exists logo_url;

commit;
