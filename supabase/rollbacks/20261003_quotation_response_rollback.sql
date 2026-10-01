-- Rollback for 20261003_quotation_response.sql

begin;

revoke all on function public.respond_quotation(uuid, text, text) from authenticated;
revoke all on function public.client_respond_quotation(uuid, text, text) from authenticated;

drop function if exists public.client_respond_quotation(uuid, text, text);
drop function if exists public.respond_quotation(uuid, text, text);

commit;
