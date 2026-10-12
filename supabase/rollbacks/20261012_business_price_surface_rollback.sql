-- Rollback for 20261012_business_price_surface.sql

alter table public.org_settings drop column if exists business_show_sell_price;
alter table public.org_settings drop column if exists business_use_best_cost;
