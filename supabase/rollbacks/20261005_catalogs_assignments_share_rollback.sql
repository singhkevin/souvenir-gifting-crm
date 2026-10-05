-- Rollback for 20261005_catalogs_assignments_share.sql
-- Does not restore campaigns.company_id NOT NULL: unassigned catalogs would block that.

begin;

revoke all on function public.get_shared_catalog(text) from anon, authenticated, public;
drop function if exists public.get_shared_catalog(text);

drop policy if exists catalog_share_links_staff_all on public.catalog_share_links;
drop table if exists public.catalog_share_links;

drop policy if exists client_selections_assigned_update on public.client_product_selections;
drop policy if exists client_selections_assigned_insert on public.client_product_selections;
drop policy if exists campaign_products_assigned_client_select on public.campaign_products;
drop policy if exists campaigns_assigned_client_select on public.campaigns;

drop policy if exists catalog_assignments_client_select on public.catalog_assignments;
drop policy if exists catalog_assignments_staff_all on public.catalog_assignments;
drop table if exists public.catalog_assignments;

drop policy if exists campaigns_allow_unassigned_company on public.campaigns;
drop policy if exists campaigns_insert_unassigned on public.campaigns;

drop index if exists public.campaigns_cloned_from_idx;
alter table public.campaigns drop column if exists cloned_from;

revoke all on function public.is_catalog_staff() from public, authenticated;
drop function if exists public.is_catalog_staff();

commit;
