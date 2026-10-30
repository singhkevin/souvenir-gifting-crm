-- Rolls back 20261030_store_backorders.sql.
-- Store arrangement rows are removed. Requirements that used source store_backorder
-- are kept and labelled website so the older source check can be restored.
-- Run this only when no later migration has added another requirements.source value.

begin;

drop trigger if exists products_enqueue_store_stock_alerts on public.products;
drop function if exists public.enqueue_store_stock_alerts();

drop table if exists public.store_stock_alert_jobs;
drop table if exists public.store_stock_alerts;
drop table if exists public.store_backorder_lines;
drop table if exists public.store_backorder_requests;

update public.requirements
set source = 'website'
where source = 'store_backorder';

alter table public.requirements drop constraint if exists requirements_source_check;
alter table public.requirements
  add constraint requirements_source_check
  check (source in ('staff', 'corporate_portal', 'business_portal', 'website'));

comment on column public.requirements.source is
  'staff, corporate_portal, business_portal, or website.';

commit;
