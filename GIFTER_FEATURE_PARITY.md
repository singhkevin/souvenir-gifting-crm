# Gifting Solutions feature parity

Permanent reference for Oaklane vs the Gifting Solutions CRM product.

**Reference source:** Written Gifting Solutions functional specification supplied with this task. A walkthrough video was requested but **no video file was found** in the project workspace or common media folders. Re-audit screen-by-screen if a video is attached later.

**Existing application status key:** EXISTS / PARTIAL / MISSING / BROKEN  
**Implemented** reflects the 2026-09-03 parity pass unless noted.

---

## Dashboard

## Where Observed

Gifting Solutions spec: role-specific home (admin / sales / operations / accounts / management / employee / client).

## Existing Application Status

PARTIAL (role KPI dashboards existed; employee “what do I do now” was incomplete)

## Required Change

Keep role dashboards; add My Work and pending/delayed ownership.

## Implemented

Yes — `/crm/dashboard`, `/crm/my-work`, `/portal`

## Tested

Code-level: queries aligned to live schema. Production UI to be verified after deploy.

---

## Goal Tracker

## Where Observed

Gifting Solutions module list: Goals.

## Existing Application Status

BROKEN (UI used `goal.period`; DB has `period_type` + `period_start`; not in nav)

## Required Change

Bind to live columns; allow create; show in management nav.

## Implemented

Yes — `/crm/goals`

## Tested

Pending production login.

---

## Leads

## Where Observed

Gifting Solutions sales pipeline.

## Existing Application Status

EXISTS — `/crm/leads`, stages, convert flow

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Regression: do not rewrite.

---

## Companies

## Where Observed

Gifting Solutions customers.

## Existing Application Status

PARTIAL (list owner join used non-existent `first_name`/`last_name`)

## Required Change

Create/search/filter; owner from `profiles.full_name`.

## Implemented

Yes — join fix + existing `/crm/companies/new`

## Tested

Pending production.

---

## Contacts

## Where Observed

Gifting Solutions people on companies.

## Existing Application Status

PARTIAL (list/search existed; Add Contact was a no-op)

## Required Change

Create contact with company, type, email, phone.

## Implemented

Yes — `/crm/contacts`

## Tested

Pending production.

---

## Requirements

## Where Observed

Gifting Solutions brief / campaign input.

## Existing Application Status

EXISTS — internal + portal create; activity tab queried missing `requirement_id`

## Required Change

Activities via `related_type`/`related_id`.

## Implemented

Yes.

## Tested

Pending production.

---

## Mockups

## Where Observed

Gifting Solutions design files on requirements/orders.

## Existing Application Status

BROKEN (`file_url`, `requirements.title`)

## Required Change

`storage_path`, `file_name`, mime, requirement/order association, client vs internal visibility.

## Implemented

Yes — register URL; `shared` visible in portal documents via RLS.

## Tested

Pending production.

---

## Samples

## Where Observed

Gifting Solutions sample stock and movement (office / team / client / supplier).

## Existing Application Status

BROKEN (wrong quantity column names; no movement UI; hidden from nav)

## Required Change

Track locations, holder, client, cost (internal), issue/return via movement history.

## Implemented

Yes — `/crm/samples` + `sample_movements` + `with_team`

## Tested

Pending production.

---

## Orders / Order Management

## Where Observed

Gifting Solutions fulfilment board.

## Existing Application Status

EXISTS — Order Control Center, stages, department, assignee, health, history

## Required Change

Preserve and keep using `advance_order_stage`.

## Implemented

Pre-existing this cycle.

## Tested

Demo orders SO-2026-2010… already in DB.

---

## Products

## Where Observed

Gifting Solutions internal catalogue (variants, supplier, price, MOQ, images).

## Existing Application Status

EXISTS — internal product CRUD. Must **not** be the client catalogue.

## Required Change

Keep internal; clients only see campaign offerings.

## Implemented

Yes — portal no longer queries `products`.

## Tested

Pending Wipro portal login.

---

## Suppliers / Printing Vendors / Courier Partners

## Where Observed

Gifting Solutions vendor modules.

## Existing Application Status

EXISTS — list pages

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## Accounts (invoices, payments, receivables, payables)

## Where Observed

Gifting Solutions finance.

## Existing Application Status

EXISTS — lightweight finance, role-gated

## Required Change

Preserve; do not build a full ERP.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## Tasks

## Where Observed

Gifting Solutions work items.

## Existing Application Status

BROKEN (`due_date` vs `due_at`; integer priority; not in nav)

## Required Change

Create/complete; My Tasks vs All; due dates.

## Implemented

Yes — `/crm/tasks`

## Tested

Pending production.

---

## Reports

## Where Observed

Gifting Solutions reporting.

## Existing Application Status

PARTIAL (sample report used wrong columns)

## Required Change

Sales/orders/finance/samples against live fields.

## Implemented

Yes — sample qty/value uses `in_office` / `unit_cost`.

## Tested

Pending production.

---

## Team / Settings / Audit log

## Where Observed

Gifting Solutions admin.

## Existing Application Status

EXISTS

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## Reviews

## Where Observed

Gifting Solutions client feedback.

## Existing Application Status

BROKEN (`comments` vs `feedback`; not in nav). Write policy is admin-only.

## Required Change

Display feedback; admin can log a review.

## Implemented

Yes — `/crm/reviews`

## Tested

Pending admin login. Sales cannot insert (RLS).

---

## Notifications

## Where Observed

Gifting Solutions alerts on assignment, stage, quote, payment.

## Existing Application Status

EXISTS — `notifications` + topbar; stage RPC already notifies

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## Client Portal

## Where Observed

Gifting Solutions client login: own campaigns, products, quotes, orders.

## Existing Application Status

PARTIAL — isolation existed; catalogue leaked global products

## Required Change

Wipro sees only Wipro published offerings.

## Implemented

Yes — `campaign_products` + RLS.

## Tested

Pending `priya@wipro.example` login.

---

## Client-specific products

## Where Observed

Mandatory: internal catalogue vs campaign subset.

## Existing Application Status

BROKEN in UI (DB already had `campaign_products`)

## Required Change

Sales curates/publishes; client sees published only.

## Implemented

Yes — `/crm/campaigns/[id]` + portal catalogue.

## Tested

Wipro Diwali campaign has a curated published set (not the full catalogue).

---

## Quotations

## Where Observed

Requirement → pricing → send → client accept/reject → order.

## Existing Application Status

EXISTS — `client_respond_quotation`, `convert_quotation_to_order`

## Required Change

Preserve; never expose supplier cost/margin.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## Activities

## Where Observed

Gifting Solutions call/email/meeting/message/follow-up.

## Existing Application Status

BROKEN (`activity_type`, company join; no create)

## Required Change

Use `type`, `title`, `related_type`/`related_id`; create form.

## Implemented

Yes — `/crm/activities`

## Tested

Pending production.

---

## Order health / department / My Work / Order Control Center

## Where Observed

Gifting Solutions operational control (spec sections 15–18).

## Existing Application Status

EXISTS from prior operational CRM pass

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Demo staged orders in DB.

---

## Client order tracking

## Where Observed

Portal order status without internal notes.

## Existing Application Status

EXISTS

## Required Change

Preserve.

## Implemented

Pre-existing.

## Tested

Regression only.

---

## WhatsApp / Email automation / AI / Advanced BI

## Where Observed

Spec P2.

## Existing Application Status

MISSING (by design)

## Required Change

Do not implement unless a later video proves a hard requirement.

## Implemented

No.

## Tested

N/A

---

## 2026-09-03 — Personalised catalogue, branding, navigation

| Feature | Status | Notes |
| --- | --- | --- |
| Gifting Solutions branding | Done | Sidebar, portal header, login, page title, Settings default. Demo login emails unchanged (real credentials). |
| Old colour palette | Not recoverable | `--color-*` tokens and the hardcoded greens are the same palette; no earlier palette exists in the tree and git history is unavailable. Touched components consolidated onto the tokens; no new colours invented. |
| Nested-page back crash | Fixed | Root cause was `next/image` with unconfigured host in `CompanyAvatar`, plus a total absence of error boundaries. |
| Error / not-found boundaries | Added | App root, `/crm`, `/portal`, plus `global-error`. |
| Breadcrumbs | Partial | `Breadcrumbs` + `PageHeader` components added and applied to the company detail page. Not yet rolled out to every nested route. |
| Company logo | Done | Column, bucket and storage RLS already existed; added upload/replace/remove actions and UI, and a resilient shared `CompanyAvatar`. |
| SKU unique + stable | Already correct | `products_sku_unique` exists; live data clean (23/23 distinct, 0 blank). No backfill needed. SKU changes now admin-only and audited. |
| Product visibility (all / selected / none) | Done | Reuses `products.catalogue_access` + `company_product_access`; check constraint added. |
| Client catalogue isolation | Done + tested | New `client_products` definer view; isolation proven with SQL (see changelog). |
| Admin catalogue assignment UI | Already existed | Product detail page grant/revoke + visibility mode; list shows "All Clients" / "N Clients" / "Internal Only". Role checks added to the server actions. |
| Catalogue audit trail | Done | `audit_products` + `write_catalogue_access_audit` triggers into `audit_logs`. |
| Historical data integrity | Verified by inspection | Order/quotation item RLS keys off the parent record's company, never off catalogue access. |
| Client search/filter/pagination | Done | Server-side, inside the secured view, so counts and totals cannot leak. |
| Searchable company multi-select | Partial | Assignment is one company at a time via a dropdown; no multi-select with select-all yet. |

## Known remaining gaps

- Admin catalogue assignment is one company per action; no searchable multi-select with select-all, and no inline "Catalogue updated" toast (the page revalidates instead).
- Breadcrumbs applied to the company detail page only; other nested routes still rely on the back button alone.
- `#4A235A` purple remains on quotation and product screens and is outside the token palette.
- Client shortlisting still applies only to campaign offerings, because `client_product_selections` requires `campaign_id`/`campaign_product_id`.
- Mockup “upload” is URL registration, not binary storage upload.
- Client cannot auto-update `campaigns.status` (write is internal-only); sales sees selections on the campaign page.
- Review insert is admin-only by RLS.
- No Gifting Solutions video file was available for pixel-level screen audit.
- Binary file storage buckets for mockups/samples photos not wired.
