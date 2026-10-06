# Project state — Souvenir - Gifting Solutions Corporate Gifting CRM

Last updated: 2026-10-06

This is the existing Souvenir - Gifting Solutions application (not a new project). Earlier revisions
carried an "Oaklane" product name in the UI; the displayed brand is now Souvenir - Gifting Solutions.
The `*@oaklane.demo` login addresses are real Supabase credentials and must not be
renamed.

- Production: https://www.giftingstore.online/ on the existing Vercel project. `*.vercel.app` stays the main CRM and does not route company subdomains.
- Company portals: `https://{portal_slug}.giftingstore.online` via the Vercel wildcard and `ROOT_DOMAIN`. No per-slug Hostinger parked domain.
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

`created` (Order received) → `procurement` → `mockup` → `client_approval` → `production` → `packaging_qc` (Packaging / QC) → `dispatched` (Dispatch) → `delivered` / `cancelled`

Stage changes go through `advance_order_stage` and append `order_status_history`. Staff can move one stage at a time, cancel an open order, or send `client_approval` back to `mockup`. Production is blocked until `orders.client_approval_status = 'approved'`. Portal users of that company call `client_decide_order_approval`: approve stays on Client approval and unlocks Production; request changes returns the order to Mockup. Re-entering Client approval clears the previous decision.

Migration `20261006_fulfillment_stages_client_approval.sql` converts enum status columns to text, recreates dependent views such as `public.portal_orders` from the catalog (same owner, options, and grants), and remaps existing rows (history notes keep the original token):

| Previous status | Stored as |
| --- | --- |
| `created` | `created` |
| `confirmed` | `created` |
| `in_progress` | `procurement` |
| `procurement` | `procurement` |
| `printing` | `production` |
| `quality_check`, `ready_to_dispatch` | `packaging_qc` |
| `dispatched` | `dispatched` |
| `delivered`, `cancelled` | unchanged |

`in_progress` is not sent to Production: the previous sequence placed it before procurement. `printing` stays in Production so live branding work is not pulled back through the new gate.

## Client catalogue rule

Internal staff use `products` directly. RLS on `products` is internal-only —
**never query `products` from the portal.**

Clients read through two complementary layers:

1. **`public.client_products`** (view) — the evergreen personalised catalogue.
   Resolves the caller's company server-side via `client_company_id()` and returns
   only products where `status = 'active'`, `catalogue_access <> 'none'`, and
   either `catalogue_access = 'all'` or the company has a `company_product_access`
   grant, minus any `company_product_exclusions` for that company. Exposes
   client-safe columns only. All portal search, filtering, sorting,
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
Production brand and domains (see `.env.example` and README): `NEXT_PUBLIC_APP_NAME=Souvenir - Gifting Solutions`, `NEXT_PUBLIC_APP_SHORT_NAME=Souvenir`, `NEXT_PUBLIC_SITE_URL=https://www.giftingstore.online`, `ROOT_DOMAIN=giftingstore.online`. Optional `NEXT_PUBLIC_MARKETING_URL` (for example `https://souvenirgifting.com`) is not the portal root.  
Never commit `.env`, `deploy_full.py`, or `deploy-all-ready.json`.
