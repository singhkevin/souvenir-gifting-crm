# Changelog — Oaklane / Corporate Gifting CRM

## 2026-09-03 — Product images, catalogue UI, hover contrast, login `next`

### Preserved

Company → lead → requirement → quotation → order → vendor → invoice workflow, `client_products` view, `company_product_access`, SKU unique index, company logos, back-button architecture, role navigation.

### Bugs fixed

- **Login dropped the destination.** Unauthenticated `/dashboard` now redirects to `/login?next=/dashboard` (via `proxy.ts`). After sign-in, staff return to that path; clients are kept on `/portal`. Logged-in visits to `/login` bounce home.
- **Wrong-role access** redirected to the dashboard with no explanation. `requireStaff` now sends people to `/crm/access-denied`.
- **Missing/broken product photos** showed empty boxes or broken icons. Shared `ProductImage` falls back to a Souvenir - Gifting Solutions placeholder on null, empty, invalid and failed URLs, used on product list/detail, portal catalogue, shortlist, campaign offerings, and company product tables.
- **No product image upload.** Admin/sales can upload, replace or remove a JPG/PNG/WebP (max 5 MB) into the `product-images` bucket. A failed upload does not overwrite the previous image.
- **Hover text unreadable** on forest-green and plum action buttons (dark hover background, no hover text colour). Global CSS plus the `Button` component now keep a light label on hover, with focus-visible rings.
- **Catalogue assignment was one company at a time.** Product detail now has All / Selected / None radios, company search, select-all, clear, and a save toast.

### Database

Additive only: public `product-images` storage bucket (5 MB, PNG/JPEG/WebP) with internal write policies. Existing `catalogue_access` / `company_product_access` reused. No data reset.

---

## 2026-09-03 — Souvenir - Gifting Solutions feature-parity pass

### What already existed

- Internal CRM: companies, contacts, leads, requirements, products, quotations, orders
- Client portal login and company isolation via `client_company_id()`
- Campaigns table, `campaign_products`, `client_product_selections`
- Order Control Center, My Work, department assignment, order health, stage history
- Invoices, payments, receivables, payables
- Role-aware navigation and notifications
- Wipro Diwali 2026 campaign demo data (no database reset)

### What the Souvenir - Gifting Solutions reference requires

A full corporate-gifting operating system: dashboard, goals, leads, companies, contacts, requirements, mockups, samples (with movement), orders, products, suppliers / printing / courier, accounts, tasks/activities, reports, team, reviews, settings, notifications, client portal, **client-specific product catalogue**, quotations, and the requirement → quote → order → fulfilment → invoice lifecycle.

A reference video was requested with this task. No video file was present in the workspace, Downloads, Desktop, or Videos folders, so the audit used the written Souvenir - Gifting Solutions functional specification plus the existing Oaklane schema/UI as the product reference. If a video is attached later, re-check any screen-only modules against `GIFTER_FEATURE_PARITY.md`.

### What was missing or broken

- Portal catalogue showed global `catalogue_access=all` products (clients could see the internal catalogue)
- Shortlist lived in `localStorage` instead of `client_product_selections`
- Campaigns list used non-existent columns (`title`, `notes`, `deadline`) and had no curate/publish UI
- Samples used `in_office_qty` etc. instead of `in_office` / `with_client` / `pending_supplier`; no movement history
- Mockups used `file_url` / `requirements.title` instead of `storage_path` / `requirements.name`
- Goals used `goal.period`; reviews used `comments`; tasks used `due_date`; activities used `activity_type` / `companies`
- Contacts “Add Contact” did nothing
- Samples, Goals, Reviews, Tasks were not in primary navigation
- Shared mockups were not visible to clients

### 2026-09-03 — Operational Kanban, search, role dashboards

- Order Control Center table/kanban toggle with server-validated drag-and-drop
- Global internal search (orders, clients, campaigns, requirements, products, people)
- Role dashboards: admin org/dept/people, management exceptions, sales follow-ups, operations pending stages, accounts invoicing buckets
- Accounts can no longer change operational order stages
- Delivery date range filters on Order Control Center

### What was implemented

- Campaign create + offering curate/publish/unpublish
- Portal catalogue and detail pages read **published campaign products only**
- Shortlist/select persists to `client_product_selections` (RLS: own company)
- Sample receive + location movement + history; `with_team` column
- Mockup URL registration with internal vs client-facing (`shared`) visibility
- Client documents page lists shared mockups
- Goals, reviews, tasks, contacts, activities create/list aligned to live schema
- Sidebar: Tasks, Samples, Goals, Reviews, Activities
- Companies list owner join uses `profiles.full_name`
- Docs: `PROJECT_STATE.md`, `GIFTER_FEATURE_PARITY.md`, this changelog

### Database (additive, no reset)

- `sample_stock.with_team`
- `mockups_select_client` RLS for shared mockups
- Published remaining Diwali draft offering and added two more published Wipro offerings (still a curated subset, not the full catalogue)

## 2026-09-03 — Souvenir - Gifting Solutions branding, back-button crash, personalised client catalogue

### Branding

Product name restored to **Souvenir - Gifting Solutions** in the sidebar, portal header, login screen,
browser title and the Settings default organisation name. Demo login emails
(`*@oaklane.demo`) and the demo password are real Supabase credentials and were
deliberately left untouched.

**On the colour scheme:** the "old palette" could not be recovered. `globals.css`
defines a Tailwind v4 `@theme` token set whose `--color-primary` is `#1A3022` —
i.e. the CSS variables and the hardcoded greens (`#1A3022`, `#E5DFD5`, `#5A5248`,
`#7A7267`) are *the same palette*, not two competing ones. Without git history
there is no earlier palette in the working tree to restore. As instructed, no new
colours were invented; touched components were moved onto the existing
`var(--color-*)` tokens. The one genuine outlier is `#4A235A` (purple) used on the
quotation and product screens, which does not belong to the token set; it is
listed as a remaining cleanup item rather than changed wholesale.

### Back button: root cause

The crash was **not** in the back navigation itself. Every `BackButton` call site
passes an explicit `href`, so the old `router.back()` branch never executed.

Two real causes, both fixed:

1. **`CompanyAvatar` rendered `next/image` with `src={company.logo_path}`** while
   `next.config.ts` had **no `images` configuration at all**. For any company with
   a logo this throws an unrecoverable render error ("invalid src prop / hostname
   not configured"). `/crm/companies/[id]` is exactly a nested page that uses both
   `CompanyAvatar` and `BackButton`.
2. **There was no `error.tsx`, `not-found.tsx` or `global-error.tsx` anywhere in
   the app.** With no boundary, any render error — including the one above and
   every `notFound()` call on a detail page — surfaced as the bare Next.js
   "Application error" screen instead of a recoverable UI.

Compounding this: the companies list built logo URLs from a **`logos`** bucket,
but the real bucket is **`company-logos`**, so every list logo was a broken image.

### Back button: fix

- `CompanyAvatar` no longer uses `next/image`. It resolves `logo_path` (bare
  storage path *or* full URL) to a public URL, renders a plain `<img>`, and falls
  back to coloured initials via `onError` — so a broken image icon can never show.
- Added `error.tsx` + `not-found.tsx` at the app root and for both `/crm` and
  `/portal`, plus a root `global-error.tsx`. The portal copies are deliberately
  generic ("Not available") so a client cannot distinguish "does not exist" from
  "not in your catalogue".
- `BackButton` now renders a real `<a href>` to the resolved parent (so it works
  pre-hydration, supports middle-click, and degrades without JS) and intercepts
  plain left-clicks: it calls `router.back()` only when a new `NavHistoryTracker`
  confirms in-app history exists for this tab, otherwise it pushes the logical
  parent route derived from the pathname. This holds for deep links, refreshes,
  external referrers, nested routes and filtered/paginated lists.
- Added `images.remotePatterns` for Supabase public storage as defence in depth.

### Company logo

`companies.logo_path`, the public `company-logos` bucket (2 MB, PNG/JPEG/WebP/SVG)
and its storage RLS policies already existed — only the UI was missing. Added
`uploadCompanyLogo` / `removeCompanyLogo` server actions (role-checked, MIME and
2 MB validated, old object cleaned up, orphan removed if the row update fails) and
upload/replace/remove controls on the company detail page. The list and detail
pages now share the single `CompanyAvatar` component, with logo and name both
linking to the existing company route.

SVG is accepted by the bucket but rejected by the app action, since these files are
served publicly and SVG can carry script.

### SKU

Already correct at the database level: `sku` is `NOT NULL` with a
`products_sku_unique` unique index. Audited live data — 23 products, 23 distinct
SKUs, 0 blank, 0 non-uppercase — so **no backfill was needed**. Added a one-time
normalising `update` in the migration for safety, a check constraint on
`catalogue_access`, and made SKU stable in the app: `updateProduct` only applies a
SKU change when it actually differs *and* the caller is an admin, and unique
violations now return "That SKU is already used by another product".

### Bug: editing a product erased its supplier and margin

`updateProduct` wrote `supplier_id` and `internal_margin` on every save, but the
edit form rendered neither field — so `formData.get(...)` returned null and every
product edit silently wiped both. Rewritten to only write keys the submitted form
actually contains, and the supplier select was added to the form.

### Personalised client catalogue — final model

Reused the existing entities rather than building a parallel system:

| Layer | Purpose |
| --- | --- |
| `products` | Single product master. One row per product, SKU unique. Never cloned per client. |
| `products.catalogue_access` | `all` \| `selected` \| `none` — governs client discovery. |
| `company_product_access` | Which companies see a `selected` product. |
| `campaign_products` | Unchanged. Campaign-specific curated offerings, which is what clients shortlist. |

The two client-facing layers are complementary, not competing: `/portal/catalogue`
now shows the evergreen personalised catalogue by default, and keeps the existing
campaign-offering experience (with shortlisting) when `?campaign=` is present.
Shortlisting stays on campaign offerings because `client_product_selections`
requires `campaign_id` and `campaign_product_id`.

### Security

Clients never touch `products`. A new `public.client_products` view is the single
boundary: it resolves the caller's company server-side via `client_company_id()`,
filters to `status = 'active'`, `catalogue_access <> 'none'` and the company's
grants, and exposes **only** client-safe columns. `supplier_id`, `supplier_cost`,
`internal_margin`, `internal_notes`, `catalogue_access`, `visibility` and `status`
are omitted entirely, so they cannot leak through column selection. Category,
subcategory and brand names are resolved inside the view because those tables are
internal-only under RLS.

Search, category filter, sort, pagination and the `count` all execute inside that
view, so nothing leaks through result counts or page totals. Product detail reads
the same view and returns the generic portal not-found page when there is no row.

Catalogue visibility changes are audited: an `audit_products` trigger (reusing the
existing `write_audit()`) plus a dedicated `write_catalogue_access_audit()` trigger
for `company_product_access`, which needs its own function because it has a
composite key and no `id` column. Both record user, action, product, SKU and
timestamp into `audit_logs`.

Server actions `createProduct`, `updateProduct`, `grantCompanyProductAccess` and
`revokeCompanyProductAccess` now enforce admin/sales roles, on top of the existing
`products_write` / `cpa_write` RLS.

### Historical data integrity

Verified by inspecting RLS: `order_items_select` and `quot_items_select` key only
off the parent order/quotation's `company_id` and never reference
`catalogue_access` or `company_product_access`. Revoking catalogue access therefore
cannot hide a product inside a client's existing quotation or order. Live data
confirms this matters — two order lines and one quotation line already reference a
product that is now restricted to a different company.

### Other fixes

- Products list: the "All Clients" visibility chip actually disabled filtering
  (`access=all` was the no-filter sentinel), so that state was unreachable. Split
  into an explicit "Any" chip plus real `all`/`selected`/`none` filters.
- Products list had no pagination and loaded the whole catalogue; now 50 per page,
  server-side, with filter-preserving links.
- Replaced mojibake `?` separators with `·` on the pages touched.

## 2026-09-03 — Quotation/order audit pass (costing, vendors, status guards)

### Audit finding: the database was ahead of the UI

The Postgres layer already had almost everything the reference workflow needs and was
being under-used by the pages:

- `recalc_order_cost`, `convert_quotation_to_order` (idempotent, role-checked,
  refuses non-accepted quotations), `duplicate_quotation`, `move_sample`
  (blocks negative stock), `prevent_lead_hot_downgrade` + `prevent_lead_regression`
- `write_audit` triggers on companies, contacts, leads, requirements, quotations,
  orders, invoices, payments, mockups, campaigns
- `track_order_status` (writes `order_status_history`) and
  `payments_refresh_invoice` (recomputes invoice status from real payments)

No new tables, columns, RPCs or triggers were needed in this pass.

### Bugs found and fixed

- **Quotations list was permanently empty.** It selected `requirements(id, title)`,
  `quote_number` and `total_amount` — none of which exist — and embedded
  `profiles(...)` without a hint even though `quotations` has two FKs to `profiles`
  (`owner_id`, `responded_by`), so PostgREST rejected the whole query. Rewritten
  against the real columns (`quotation_number`, `total`, `requirements.name`,
  `profiles!owner_id`).
- **Client portal showed every quotation as $0.00** — `total_amount` instead of
  `total`, and a hardcoded `$` instead of the app's rupee formatter.
- **Dead "Create Quote" button** replaced with a link to Requirements, which is
  where `createQuotationFromRequirement` actually lives (a quotation must belong
  to a requirement).
- **Client-submitted portal requirements were owned by the client user**, so they
  never appeared in any internal owner filter. Ownership now routes to the
  company's account manager.
- Portal quotation list selected `*`, sending internal columns to the browser; now
  an explicit client-safe column list.
- Crashes on empty/odd data: `quote.status.toUpperCase()` on a null status,
  `new Date()` formatting of null dates, `formData.products.length` when absent.
- Order costing, vendor assignment and delivery dates had no server-side role
  check — only the UI hid them.

### New functionality

- **Order costing entry** (financials tab, `canSeeCosts` roles only): product,
  printing, courier and other cost inputs. `total_cost` and `gross_profit` are
  recalculated by `recalc_order_cost` server-side and are never accepted from the
  client. Panel now shows revenue, total cost, gross profit and margin %.
- **Printing vendor assignment** on orders — `orders.printing_vendor_id` and the
  `printing_vendors` table both existed but nothing in the UI wrote to it.
- **Dispatch / expected / actual delivery date capture**, with a guard that actual
  delivery cannot precede dispatch. Expected and actual stay separate fields.
- Quotation list: search by quote number, "my quotations" filter, accepted-rate and
  pipeline value summary, lapsed-validity highlighting.

### Permission changes (all enforced in server actions, not just hidden in the UI)

- `assignSupplier`, `assignPrintingVendor`, `assignCourier`, `recordDelivery` → admin/operations
- `saveOrderCosting` → `canSeeCosts` (admin/accounts/management)
- `receiveSample`, `moveSample` → admin/sales/operations, matching the `move_sample` RPC
- `updateQuotationStatus` → admin/sales/management, and now validates the
  transition (draft→sent, sent→accepted/rejected/expired; accepted and rejected
  are terminal) instead of accepting any string
- Quotation detail page now uses `requireStaff()`; it previously only checked for
  a logged-in user, so client accounts were not redirected away

### Duplicate-order protection

`convert_quotation_to_order` already returns the existing order id when one is
linked, so double-clicking could not create two orders. The UI now reflects that:
once converted, the button becomes "View order <number>".
