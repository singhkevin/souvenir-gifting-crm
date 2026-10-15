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
27. **`20261007_action_idempotency.sql`** ← idempotency for mutating actions: `action_idempotency` keys, `advance_order_stage` expected-stage guard, quote accept returns the existing order, approval repeat is a no-op (rollback: `supabase/rollbacks/20261007_action_idempotency_rollback.sql`). Safe to apply before or after the app deploy; the app falls back when the new functions are missing.
28. **`20261008_products_client_granted_select.sql`** ← RLS: portal clients can read active `selected`-access products they were granted and not excluded from. Already applied in production; idempotent (drop policy if exists + create).
29. **`20261009_catalog_per_company_pricing.sql`** ← one catalog, many companies: `campaign_products.manual_price` / `priced_company_id`, `catalog_share_links.company_id`, `place_direct_order` catalog branch prices from the buying company's margin (rollback: `supabase/rollbacks/20261009_catalog_per_company_pricing_rollback.sql`). Apply after 20261006_buy_vs_rfq; the app falls back to stored prices until it is applied.
30. **`20261009_revoke_anon_rpc.sql`** ← drops the legacy `client_respond_quotation(uuid, boolean, text)` overload (still present in production until 2026-10-09) and revokes anon/public execute, granting authenticated only, on the quote/notification RPCs (rollback: `supabase/rollbacks/20261009_revoke_anon_rpc_rollback.sql`). Applied to production on 2026-10-09.
31. **`20261012_business_role_enum.sql`** ← adds `business_user` to `app_role`. Apply in its own transaction before the next file. The enum value cannot be dropped; the rollback only deactivates those profiles (rollback: `supabase/rollbacks/20261012_business_role_enum_rollback.sql`).
32. **`20261012_business_accounts_foundation.sql`** ← `companies.account_type` / verification columns, `is_business()`, `business_company_id()`, additive SELECT policies (rollback: `supabase/rollbacks/20261012_business_accounts_foundation_rollback.sql`).
33. **`20261012_business_registration.sql`** ← default business owner, `rate_limit_hits`, `hit_rate_limit()`, `register_business_account()` (rollback: `supabase/rollbacks/20261012_business_registration_rollback.sql`).
34. **`20261012_business_price_surface.sql`** ← `business_use_best_cost`, `business_show_sell_price` (rollback: `supabase/rollbacks/20261012_business_price_surface_rollback.sql`).
35. **`20261012_business_rfq.sql`** ← requirement source and idempotency id, line target price and quantity breaks, `business_submit_rfq()` (rollback: `supabase/rollbacks/20261012_business_rfq_rollback.sql`).
36. **`20261012_business_quotes.sql`** ← revision columns, quote validity, `business_respond_quotation()` (no order), viewed marker, `expire_business_quotations()` (rollback: `supabase/rollbacks/20261012_business_quotes_rollback.sql`).
37. **`20261012_quote_checkout.sql`** ← `quote_checkout_tokens`, `place_quote_order()`, a unique `orders(quotation_id)` index only when one does not already exist, and a trigger that locks `quotation_items` once the parent quotation is accepted (rollback: `supabase/rollbacks/20261012_quote_checkout_rollback.sql`). `orders_quotation_id_key` from the base schema is left in place when present.
38. **`20261013_product_costs.sql`** ← staff-only `product_costs` (RLS via `is_pricing_staff()`). Backfills `supplier_cost`, `internal_margin`, and `internal_notes` from `products`, repoints catalogue and order functions at `product_costs`, then drops those columns from `products` (rollback: `supabase/rollbacks/20261013_product_costs_rollback.sql`). Apply after 37 so `place_quote_order` exists before it is replaced.
39. **`20261013_admin_guard.sql`** ← `profiles_guard_admin` trigger: a signed-in user cannot change the role or `is_active` of, or delete, another admin (service role / direct DB session only), and nobody can demote, deactivate, or delete the last active admin (rollback: `supabase/rollbacks/20261013_admin_guard_rollback.sql`).
40. **`20261014_order_source.sql`** ← `orders.source`, `orders.public_token_hash`, source/status index, and `place_direct_order` (optional `p_source`), `place_quote_order`, `client_respond_quotation`, and `convert_quotation_to_order` set source and the first `order_status_history` row (rollback: `supabase/rollbacks/20261014_order_source_rollback.sql`). `place_direct_order` is dropped and recreated, then granted to authenticated and service_role only.
41. **`20261014_categories_unique.sql`** ← unique index `categories_name_ci` on `lower(btrim(name))`. Aborts if duplicate names exist and lists them. Adds `categories_insert_staff` only when RLS is already on and no insert policy mentions admin or sales (rollback: `supabase/rollbacks/20261014_categories_unique_rollback.sql`).
42. **`20261015_shared_catalog_visibility.sql`** ← `get_shared_catalog` returns only products the viewer can see (signed-in client: their company; guest: public catalogue, or the link's company when `catalog_share_links.company_id` is set). Kits with a hidden published member are omitted and `pack_kit_total` is the sum of published member prices (rollback: `supabase/rollbacks/20261015_shared_catalog_visibility_rollback.sql`). Applied 2026-10-13.
43. **`20261014_quote_line_totals.sql`** ← `recalc_quotation_totals` sets `line_total` to the pre-tax discounted amount `round(qty * unit * (1 - discount_percent / 100), 2)` and stores GST once on the quotation. Backfills every `quotation_items` row with `quotation_items_lock_accepted` disabled for that update. Reassigns `companies`, `quotations`, and `requirements` whose `owner_id` is an inactive profile to `org_settings.business_default_owner_id` and raises a notice with the counts. `client_respond_quotation`, `place_quote_order`, and `convert_quotation_to_order` copy that pre-tax `line_total` and add tax once (rollback: `supabase/rollbacks/20261014_quote_line_totals_rollback.sql`).
44. **`20261014_quote_requests.sql`** ← `client_request_quote_revision(uuid, text)` for portal clients (authenticated only). `expire_quotations()` expires sent and viewed quotes for every account type; `expire_business_quotations()` calls it (rollback: `supabase/rollbacks/20261014_quote_requests_rollback.sql`).
45. **`20261016_company_product_prices.sql`** ← `company_product_prices` (clients read their company; `is_pricing_staff()` writes), `listed_unit_price()`, portal `client_products` and `place_direct_order` use special price, then catalog manual price, then base price plus company margin (store stays on `resolved_sell_price`; pack rows keep `selling_price`). Drops the non-negative check on `quotation_item_costs.margin_percent`. Adds `org_settings.public_contact_phone` and `contacts.kind` if missing. `register_business_account` raises `email already registered` and `invalid GSTIN`. Pack columns stay; comments mark them retired (rollback: `supabase/rollbacks/20261016_company_product_prices_rollback.sql`). Not applied. The app falls back until this file is applied.
46. **`20261016_gift_employee_role.sql`** ← adds `gift_employee` to `app_role`. Apply in its own transaction before the next file. The enum value cannot be dropped; the rollback only deactivates those profiles (rollback: `supabase/rollbacks/20261016_gift_employee_role_rollback.sql`).
47. **`20261016_gift_selections.sql`** ← employee gift campaigns, one locked submission per employee, staff read and reset (rollback: `supabase/rollbacks/20261016_gift_selections_rollback.sql`).
48. **`20261017_presentations.sql`** ← pitch decks, one price per product or combo, share links with expiry, and `presentation_public`, which returns each slide's sell price unless `presentations.show_prices` is off (never costs or margins) (rollback: `supabase/rollbacks/20261017_presentations_rollback.sql`). Not applied.
49. **`20261017_storefront.sql`** ← `brands.logo_url` and `products.occasion_tags` for the public store (rollback: `supabase/rollbacks/20261017_storefront_rollback.sql`). The store falls back until this file is applied.

31–44 were applied to production on 2026-10-13; 45–48 were applied to production on 2026-10-15. 49 is not applied. Run `supabase/tests/presentation_check.sql` after 48; it begins a transaction and rolls it back. Run `supabase/tests/gift_selection_check.sql` after 47; it begins a transaction and rolls it back. Run `supabase/tests/business_rls_check.sql` after 35 (it inserts `requirements.source`, added in 35); it begins a transaction and rolls it back. Run `supabase/tests/order_source_check.sql` after 40; it begins a transaction and rolls it back. Run `supabase/tests/quote_flow_check.sql` after 44; it begins a transaction and rolls it back.

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
