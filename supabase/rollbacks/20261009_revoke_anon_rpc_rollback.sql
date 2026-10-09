-- Rollback for 20261009_revoke_anon_rpc.sql: re-grant anon/public execute and
-- restore the dropped legacy overload.

grant execute on function public.client_mark_quotation_viewed(uuid) to public, anon;
grant execute on function public.client_respond_quotation(uuid, text, text, uuid[]) to public, anon;
grant execute on function public.convert_quotation_to_order(uuid) to public, anon;
grant execute on function public.duplicate_quotation(uuid) to public, anon;
grant execute on function public.next_quotation_number() to public, anon;
grant execute on function public.notify_users(notification_audience, uuid, text, text, text) to public, anon;
grant execute on function public.recalc_quotation_totals(uuid) to public, anon;
grant execute on function public.respond_quotation(uuid, text, text) to public, anon;
grant execute on function public.record_campaign_event(uuid, text, jsonb) to public, anon;

-- Recreate the legacy 3-arg public.client_respond_quotation(uuid, text, text),
-- restored verbatim from its last known definition in
-- 20261003_quotation_response.sql (it called public.respond_quotation(uuid,text,text)
-- directly; superseded by the 4-arg version in 20261005_quotation_line_accept.sql).
create or replace function public.client_respond_quotation(
  p_quotation_id uuid,
  p_status text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_client() then
    raise exception 'Only portal clients can use this action';
  end if;
  perform public.respond_quotation(p_quotation_id, p_status, p_comment);
end;
$$;

grant execute on function public.client_respond_quotation(uuid, text, text) to authenticated;

-- TODO: public.client_respond_quotation(uuid, boolean, text) is NOT restored
-- here. That signature never existed in this codebase's tracked migration
-- history (see the comment in the forward migration) -- there is no
-- pg_get_functiondef output to recreate it from. If a live DB inspection
-- turns up this exact overload, paste its definition here.
