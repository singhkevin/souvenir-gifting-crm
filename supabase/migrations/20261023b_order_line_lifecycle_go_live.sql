-- Order lifecycle v2, step 3 of 3: GO LIVE. Apply only AFTER the new app is merged and
-- deployed to production (PR #42), never while production runs the order-level app.
-- Needs Kevin's approval. Rollback: supabase/rollbacks/20261023b_order_line_lifecycle_go_live_rollback.sql
--
-- 1. 'lifecycle_live' on: adding a line recomputes the order stage (store lines skip to
--    packing) and the legacy status sync trigger stops moving lines.
-- 2. advance_order_stage and client_decide_order_approval (old app entry points) now follow
--    the line rules, so a stale browser tab or old client cannot move an order by hand.

update public.order_lifecycle_settings
set settings = settings || jsonb_build_object('lifecycle_live', true), updated_at = now()
where id;

create or replace function public.advance_order_stage(
  p_order_id uuid, p_status text, p_assigned_to uuid default null, p_department_id uuid default null,
  p_comment text default null, p_stage_due text default null, p_next_action text default null,
  p_expected_status text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.olc_hand_off_order(p_order_id, p_status, p_assigned_to, p_department_id,
    p_comment, p_stage_due, p_next_action, p_expected_status);
end;
$$;

create or replace function public.client_decide_order_approval(p_order_id uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.client_decide_branding_approval(p_order_id, p_decision, p_note);
end;
$$;

-- Orders whose stage was changed by the old app since step 2 already had their lines moved by
-- olc_legacy_status_sync; bring the order stage in line with its lines once.
do $$
declare v record;
begin
  perform set_config('olc.internal', 'on', true);
  for v in select id from public.orders where status not in ('delivered', 'cancelled') loop
    perform public.recompute_order_status(v.id);
  end loop;
end $$;
