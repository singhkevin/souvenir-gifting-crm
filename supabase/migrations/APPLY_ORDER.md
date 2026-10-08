# Migration apply order

Apply forward migrations in this order. Pair each forward file with its rollback when rolling back (reverse order).

Do **not** run these against production from the agent unless explicitly requested. Deliver as files for Hostinger/ops apply.

1. `20260903_operational_crm_control_center.sql`
2. `20260903_assignment_rls_isolation.sql`
3. `20260903_tighten_write_policies.sql`
4. `20260903_prevent_lead_hot_downgrade.sql`
5. `20260903_product_images_bucket.sql`
6. `20260903_client_catalogue_access.sql`
7. `20260903_sample_team_and_client_mockups.sql`
8. `20260904_contacts_goals_isolation.sql`
9. `20260907_product_category_taxonomy.sql`
10. `20260909_convert_order_active_catalogue_only.sql`
11. `20260922_pricing_margins_domains.sql`
12. `20260923_campaign_budget_pack_options.sql`
13. `20260924_campaign_pack_kits.sql`
14. `20260924_channel_sell_price.sql`
15. `20260924_company_portal_slug.sql`
16. `20260930_tenant_status_and_slug.sql` ← Phase 1 (rollback: `supabase/rollbacks/20260930_tenant_status_and_slug_rollback.sql`)
17. **`20261001_portal_hosts.sql`** ← Phase 2 (rollback: `supabase/rollbacks/20261001_portal_hosts_rollback.sql`)
18. **`20261002_company_product_exclusions.sql`** ← company catalogue hide/show (rollback: `supabase/rollbacks/20261002_company_product_exclusions_rollback.sql`)
19. `20261003_quotation_response.sql` (rollback: `supabase/rollbacks/20261003_quotation_response_rollback.sql`)
20. **`20261005_catalogs_assignments_share.sql`** ← catalogs: assignments + share links (rollback: `supabase/rollbacks/20261005_catalogs_assignments_share_rollback.sql`)
21. **`20261005_catalog_rfq.sql`** ← catalog RFQ: `requirements.campaign_id`, `requirement_products.quantity`, share payload sku (rollback: `supabase/rollbacks/20261005_catalog_rfq_rollback.sql`)
22. **`20261005_quotation_line_accept.sql`** ← per-line portal accept creates an order (rollback: `supabase/rollbacks/20261005_quotation_line_accept_rollback.sql`)
23. **`20261005_supplier_offers.sql`** ← supplier offers, best cost, surface price toggles (rollback: `supabase/rollbacks/20261005_supplier_offers_rollback.sql`)
24. **`20261006_fulfillment_stages_client_approval.sql`** ← fulfillment stages and client approval gate (rollback: `supabase/rollbacks/20261006_fulfillment_stages_client_approval_rollback.sql`)
25. **`20261006_buy_vs_rfq.sql`** ← stock quantity, purchase flag, direct order (rollback: `supabase/rollbacks/20261006_buy_vs_rfq_rollback.sql`). Apply before using Buy. Existing products stay on Request quote until stock or the Buy flag is set.
26. **`20261008_harden_handle_new_user_role.sql`** ← sign-up trigger takes role/company_id only from app_metadata; self sign-ups become client_user (rollback: `supabase/rollbacks/20261008_harden_handle_new_user_role_rollback.sql`). Already applied to production on 2026-10-08.
27. `20261008_products_client_granted_select.sql` ← RLS: portal clients can read active `selected`-access products they were granted and not excluded from. Already applied in production; idempotent (drop policy if exists + create).
27. **`20261007_action_idempotency.sql`** ← idempotency for mutating actions: `action_idempotency` keys, `advance_order_stage` expected-stage guard, quote accept returns the existing order, approval repeat is a no-op (rollback: `supabase/rollbacks/20261007_action_idempotency_rollback.sql`). Safe to apply before or after the app deploy; the app falls back when the new functions are missing.

## Phase 2 verification SQL (after applying `20261001_portal_hosts.sql`)

```sql
-- Tables exist
select to_regclass('public.portal_hosts') as portal_hosts,
       to_regclass('public.portal_host_runs') as portal_host_runs;

-- Backfill for existing portal_slug companies (e.g. tcs)
select c.portal_slug, ph.status, ph.role, ph.desired, ph.notify_on_live
from public.companies c
left join public.portal_hosts ph
  on ph.company_id = c.id and ph.role = 'primary' and ph.status <> 'removed'
where c.portal_slug is not null
order by c.portal_slug;

-- Claim function exists and is service_role-only
select p.proname, r.rolname as grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join lateral aclexplode(p.proacl) a on true
left join pg_roles r on r.oid = a.grantee
where n.nspname = 'public' and p.proname = 'claim_portal_host_jobs';
```
