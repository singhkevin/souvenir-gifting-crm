-- Rollback for 20261012_business_quotes.sql

drop function if exists public.expire_business_quotations();
drop function if exists public.business_mark_quotation_viewed(uuid);
drop function if exists public.business_respond_quotation(uuid, text, text, uuid[]);

alter table public.org_settings drop constraint if exists org_settings_quote_validity_days_check;
alter table public.org_settings drop column if exists quote_validity_days;

alter table public.quotations drop column if exists expired_notified_at;
alter table public.quotations drop column if exists expiry_reminder_sent_at;
alter table public.quotations drop column if exists revision_requested_at;
alter table public.quotations drop column if exists revision_of;
