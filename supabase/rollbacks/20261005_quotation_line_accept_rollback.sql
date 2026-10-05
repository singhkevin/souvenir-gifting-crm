-- Rollback for 20261005_quotation_line_accept.sql
-- Restores the 3-argument client_respond_quotation from 20261003_quotation_response.sql.

begin;

revoke all on function public.client_respond_quotation(uuid, text, text, uuid[]) from authenticated, public;
drop function if exists public.client_respond_quotation(uuid, text, text, uuid[]);

alter table public.quotation_items
  drop constraint if exists quotation_items_client_response_check;

alter table public.quotation_items
  drop column if exists client_response;

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

revoke all on function public.client_respond_quotation(uuid, text, text) from public;
grant execute on function public.client_respond_quotation(uuid, text, text) to authenticated;

commit;
