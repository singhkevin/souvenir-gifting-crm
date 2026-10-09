-- Applied to production on 2026-10-09. Production did still have client_respond_quotation(uuid, boolean, text)
-- (created outside tracked migrations); this file drops it.
-- Lock down RPCs that were reachable by anon/public (Postgres grants EXECUTE to
-- PUBLIC by default, and several of these functions never had that revoked).
--
-- Note on step 1: the task spec for this migration named the legacy overload
-- public.client_respond_quotation(uuid, boolean, text). That signature never
-- existed in this codebase's history -- the real legacy overload was
-- client_respond_quotation(uuid, text, text) (see 20261003_quotation_response.sql),
-- which was already dropped in 20261005_quotation_line_accept.sql when the
-- 4-arg version (p_status, p_comment, p_accepted_item_ids) was introduced.
-- src/app/portal/actions.ts already calls the 4-arg version only; no caller
-- uses a boolean p_accept anywhere in src/. Both drops are included below,
-- defensively and idempotently (IF EXISTS), in case either signature still
-- lingers in an environment that skipped an earlier migration.
drop function if exists public.client_respond_quotation(uuid, boolean, text);
drop function if exists public.client_respond_quotation(uuid, text, text);

-- Revoke public/anon execute and grant authenticated-only on the RPCs below.
-- These are portal/CRM mutation and lookup functions that should only ever
-- be invoked by a logged-in session.
revoke execute on function public.client_mark_quotation_viewed(uuid) from public, anon;
grant execute on function public.client_mark_quotation_viewed(uuid) to authenticated;

revoke execute on function public.client_respond_quotation(uuid, text, text, uuid[]) from public, anon;
grant execute on function public.client_respond_quotation(uuid, text, text, uuid[]) to authenticated;

revoke execute on function public.convert_quotation_to_order(uuid) from public, anon;
grant execute on function public.convert_quotation_to_order(uuid) to authenticated;

revoke execute on function public.duplicate_quotation(uuid) from public, anon;
grant execute on function public.duplicate_quotation(uuid) to authenticated;

revoke execute on function public.next_quotation_number() from public, anon;
grant execute on function public.next_quotation_number() to authenticated;

revoke execute on function public.notify_users(notification_audience, uuid, text, text, text) from public, anon;
grant execute on function public.notify_users(notification_audience, uuid, text, text, text) to authenticated;

revoke execute on function public.recalc_quotation_totals(uuid) from public, anon;
grant execute on function public.recalc_quotation_totals(uuid) to authenticated;

revoke execute on function public.respond_quotation(uuid, text, text) from public, anon;
grant execute on function public.respond_quotation(uuid, text, text) to authenticated;

-- record_campaign_event(uuid, text, jsonb): grepped src/ for direct RPC calls
-- from the public share-link (/share/catalogs/[token]) and public catalogue
-- pages -- there are none. It's only invoked internally via `perform` from
-- other SECURITY DEFINER functions (place_direct_order, convert_quotation_to_order,
-- client_respond_quotation), which already run as the function owner, so
-- revoking anon here does not affect those call sites. Safe to lock down like
-- the rest of the list.
revoke execute on function public.record_campaign_event(uuid, text, jsonb) from public, anon;
grant execute on function public.record_campaign_event(uuid, text, jsonb) to authenticated;
