# Project state — Souvenir Gifting Solutions Corporate Gifting CRM

Last updated: 2026-09-03

This is the existing Souvenir Gifting Solutions application (not a new project). Earlier revisions
carried an "Oaklane" product name in the UI; the displayed brand is now Souvenir Gifting Solutions.
The `*@oaklane.demo` login addresses are real Supabase credentials and must not be
renamed.

- GitHub: https://github.com/VIAayush/corporate-gifting-crm.git
- Production: https://giffter.vercel.app/
- Supabase project: `ajysowosgjaipczrwpfv` (ap-south-1)

Do not create a second repository, Vercel project, or production URL. Do not reset the database.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase Auth, Postgres, RLS
- Vercel production deployment

## Roles

Internal: `admin`, `sales`, `operations`, `accounts`, `management`  
Client: `client_admin`, `client_user`

Demo password is documented in `.env.example` only as a pointer; secrets live in `.env` (never commit).

## Existing modules / routes

### Internal CRM (`/crm`)

- `/crm/dashboard` — role-specific KPIs
- `/crm/my-work` — assigned orders, tasks, follow-ups
- `/crm/tasks` — personal and team tasks
- `/crm/companies`, `/crm/companies/new`, `/crm/companies/[id]`
- `/crm/contacts`
- `/crm/leads`, `/crm/leads/[id]`
- `/crm/campaigns`, `/crm/campaigns/[id]` — curate/publish client offerings
- `/crm/requirements`, `/crm/requirements/[id]`
- `/crm/products`, `/crm/products/new`, `/crm/products/[id]`
- `/crm/mockups`
- `/crm/quotations`, `/crm/quotations/[id]`
- `/crm/orders`, `/crm/orders/[id]`
- `/crm/order-management` — Order Control Center
- `/crm/department`
- `/crm/suppliers`, `/crm/printing-vendors`, `/crm/courier-partners`
- `/crm/samples` — location + movement history
- `/crm/invoices`, `/crm/invoices/[id]`, `/crm/payments`, `/crm/receivables`, `/crm/payables`
- `/crm/reports`
- `/crm/goals`, `/crm/reviews`, `/crm/activities`
- `/crm/team`, `/crm/settings`, `/crm/audit-log`
- `/crm/announcements` (page exists; not primary nav)

### Client portal (`/portal`)

- `/portal` dashboard
- `/portal/campaigns`
- `/portal/catalogue` — personalised catalogue via `client_products`; falls back to
  published campaign offerings when `?campaign=<id>` is present
- `/portal/catalogue/product/[id]` — product detail, read through `client_products`
- `/portal/catalogue/[sku]` — campaign offering detail
- `/portal/shortlist` — persisted `client_product_selections`
- `/portal/quotations`, `/portal/quotations/[id]`
- `/portal/orders`, `/portal/orders/[id]`
- `/portal/requirements`, `/portal/requirements/new`
- `/portal/documents` — invoices + shared mockups

## Core tables (do not drop)

`profiles`, `companies`, `contacts`, `leads`, `requirements`, `campaigns`, `campaign_products`, `client_product_selections`, `products`, `product_variants`, `categories`, `brands`, `quotations`, `quotation_items`, `orders`, `order_items`, `order_status_history`, `order_assignments`, `departments`, `department_members`, `tasks`, `activities`, `notifications`, `mockups`, `sample_stock`, `sample_movements`, `suppliers`, `printing_vendors`, `courier_partners`, `invoices`, `payments`, `payables`, `goals`, `reviews`, `audit_log`

## Order lifecycle (live enum)

`created` (Order Received) → `confirmed` → `in_progress` → `procurement` → `printing` → `quality_check` → `ready_to_dispatch` → `dispatched` → `delivered` / `cancelled`

Stage changes go through `advance_order_stage` and append `order_status_history`.

## Client catalogue rule

Internal staff use `products` directly. RLS on `products` is internal-only —
**never query `products` from the portal.**

Clients read through two complementary layers:

1. **`public.client_products`** (view) — the evergreen personalised catalogue.
   Resolves the caller's company server-side via `client_company_id()` and returns
   only products where `status = 'active'`, `catalogue_access <> 'none'`, and
   either `catalogue_access = 'all'` or the company has a `company_product_access`
   grant. Exposes client-safe columns only. All portal search, filtering, sorting,
   pagination and counts must go through this view.
2. **`campaign_products`** — campaign-specific curated offerings, read where
   `visibility = 'published'` for the client's campaign. This is the layer clients
   shortlist against, because `client_product_selections` requires `campaign_id`
   and `campaign_product_id`.

A product exists exactly once in `products`. It is never cloned per client.
Catalogue visibility governs future discovery only; it never affects products
already referenced by a quotation or order (item RLS keys off the parent record's
company, not off catalogue access).

The view is intentionally SECURITY DEFINER and is flagged by the Supabase
`security_definer_view` linter, as are the pre-existing `portal_*` views. The view
body is the security boundary.

## Error boundaries

`src/app/{error,not-found,global-error}.tsx`, `src/app/crm/{error,not-found}.tsx`
and `src/app/portal/{error,not-found}.tsx`. Before these existed, any render error
or `notFound()` surfaced as the bare Next.js "Application error" screen. The portal
copies are deliberately generic so clients cannot distinguish "does not exist" from
"not in your catalogue".

## Navigation

`BackButton` renders a real anchor to the logical parent and only calls
`router.back()` when `NavHistoryTracker` (mounted in the root layout) confirms
in-app history exists for the tab. Do not reintroduce a bare `router.back()`.

## Environment

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_NAME`.  
Never commit `.env`, `deploy_full.py`, or `deploy-all-ready.json`.
