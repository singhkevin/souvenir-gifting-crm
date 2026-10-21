# Souvenir - Gifting Solutions: Implementation Checklist & Tracker

> **Last Updated:** 2026-10-08  
> **Status:** Active Tracking  
> **Reference Plan:** [`PRODUCTION_IMPLEMENTATION_PLAN.md`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/PRODUCTION_IMPLEMENTATION_PLAN.md)  
> **Project State:** [`PROJECT_STATE.md`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/PROJECT_STATE.md)

---

## 📊 High-Level Milestone Status Dashboard

| Milestone | Area | Status | Verified Tests / Migrations |
| :--- | :--- | :--- | :--- |
| **M0** | Database & Delivery Foundation | 🟡 Mostly Complete | Migrations 1–26 applied; TS clean; 24 unit tests pass; ESLint cleanup remaining |
| **M1** | Catalog Authoring & Reuse | 🟢 Completed | Route rename `/crm/catalogs`, Product Picker, Duplicate/Clone, Exclusions |
| **M2** | Public Sharing, Inquiry Intake & PDF | 🟡 In Progress | Share tokens, RFQ panel, Resend email live; Presentation PDF export pending |
| **M3** | Supplier Costing & Quotation Acceptance | 🟡 In Progress | Multi-supplier offers, per-line accept/reject live; Supplier PO generation pending |
| **M4** | Fulfillment & Proof Approval (Workflow v2) | 🟢 Completed | 8-stage lifecycle, client approval gate, stage progression RPC live |
| **M5** | Stock Storefront & Direct Purchasing | 🟡 In Progress | Stock vs RFQ flags, direct buy cart/RPC live; Payment gateway & reservation ledger pending |
| **M6** | Production Rollout & Domains | 🟢 Completed | `giftingstore.online` brand strings, Vercel wildcard tenant routing, auth redirects |

---

## Detailed Task Checklist

### M0: Database & Delivery Foundation
- [x] **Schema Baseline & Migration Ledger**:
  - [x] Documented migration order through `20261006_buy_vs_rfq.sql` in [`supabase/migrations/APPLY_ORDER.md`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/supabase/migrations/APPLY_ORDER.md)
  - [x] Security DEFINER hardening & RLS boundaries for tenant isolation
- [x] **Type Safety**:
  - [x] TypeScript compilation passes (`npx tsc --noEmit` exited 0)
- [x] **Automated Testing & CI**:
  - [x] Node test runner registered with TS alias support (`test/register.mjs`)
  - [x] Dedicated `npm test` script configured in `package.json`
  - [x] 24 unit tests passing across brand, catalog share, order workflow, portal host, and purchase path
- [ ] **Code Quality Readiness**:
  - [ ] Resolve ESLint warnings and React hook setState cascading render errors (`npm run lint`)

---

### M1: Catalog Authoring & Reuse
- [x] **Catalog Terminology & Route Migration**:
  - [x] `/crm/catalogs` and `/portal/catalogs` active
  - [x] Redirects from legacy `/crm/campaigns` and `/portal/campaigns` preserved
- [x] **Catalog Product Picker**:
  - [x] Filtered multi-select with min/max price sliders and search ([`CatalogProductPicker.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/catalogs/CatalogProductPicker.tsx))
  - [x] Kit / budget pack generation preserved ([`BudgetPackGenerator.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/catalogs/BudgetPackGenerator.tsx))
- [x] **Catalog Cloning / Duplication**:
  - [x] Atomic catalog duplication with target company selection ([`CatalogDuplicateForm.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/catalogs/CatalogDuplicateForm.tsx))
  - [x] Clean isolation: does not copy private share tokens, client selections, or acceptance state
- [x] **Company Access & Exclusions**:
  - [x] Company-specific product exclusions and visibility grants ([`20261002_company_product_exclusions.sql`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/supabase/migrations/20261002_company_product_exclusions.sql))

---

### M2: Public Sharing, Inquiry Intake & PDF Presentation
- [x] **Public Share Links**:
  - [x] Cryptographically random share tokens with 30-day default expiry and instant revocation ([`CatalogSharePanel.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/catalogs/CatalogSharePanel.tsx))
  - [x] Anonymous access via `/share/catalogs/[token]` route
  - [x] Secure data boundaries: internal margins and supplier costs strictly hidden
- [x] **Inquiry / RFQ Intake**:
  - [x] Client and guest RFQ panel with quantity selection ([`CatalogRfqPanel.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/components/catalogs/CatalogRfqPanel.tsx))
  - [x] `create_catalog_rfq` RPC populating requirements and requirement products
- [x] **Transactional Email**:
  - [x] Resend email delivery integration for catalog sharing and notifications ([`src/lib/email/resend.ts`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/lib/email/resend.ts))
- [ ] **Branded PDF Export**:
  - [ ] Dynamic presentation PDF export (cover, item imagery, specs, pricing, contact details)
  - [ ] Asset bounds, page break formatting, and download streaming

---

### M3: Supplier Costing, Quotations & Transactional Acceptance
- [x] **Multi-Supplier Costing**:
  - [x] Product supplier offers editor for multi-vendor cost comparison ([`SupplierOffersEditor.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/products/[id]/SupplierOffersEditor.tsx))
  - [x] Quotation costing panel resolving winning / best supplier offer ([`QuotationCosting.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/crm/quotations/[id]/QuotationCosting.tsx))
  - [x] Explicit Gross Margin vs Markup pricing semantics ([`src/lib/pricing/`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/lib/pricing/))
- [x] **Quotation Line Acceptance**:
  - [x] Per-line selection & approval in client portal ([`QuotationActions.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/portal/quotations/[id]/QuotationActions.tsx))
  - [x] Database RPC `respond_quotation_lines` converting accepted lines into exactly one order
  - [x] Client PO reference and comments capture
- [ ] **Supplier Purchase Orders (PO)**:
  - [ ] Group accepted order lines by winning supplier
  - [ ] Generate supplier PO drafts with snapshot costs
  - [ ] Issue and goods receipt tracking

---

### M4: Fulfillment & Proof Approval (Workflow v2)
- [x] **8-Stage Fulfillment Lifecycle**:
  - [x] `created` → `procurement` → `mockup` → `client_approval` → `production` → `packaging_qc` → `dispatched` → `delivered`
  - [x] `advance_order_stage` RPC enforcing valid forward and rework transitions
  - [x] Complete status history logging in `order_status_history`
- [x] **Client Approval Gate**:
  - [x] Production stage blocked until client approval is granted (`orders.client_approval_status = 'approved'`)
  - [x] Client portal decision action: Approve unlocks production; Request Changes returns to Mockup stage ([`client_decide_order_approval` RPC](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/app/portal/orders/actions.ts))
- [x] **Order Control Center & Views**:
  - [x] Kanban and tabular views updated with new fulfillment stages
  - [x] Portal timeline matching updated lifecycle
- [ ] **Proof Attachment & Revision Management**:
  - [ ] Storage-backed proof attachment with explicit version numbers and sign-off timestamps

---

### M5: Stock-Driven Storefront & Direct Purchasing
- [x] **Fulfillment Mode & Product Flags**:
  - [x] `fulfillment_mode` (`auto`, `buy_only`, `rfq_only`) and `stock_qty` support in database and admin product editor
  - [x] Purchase path resolution logic ([`src/lib/catalogue/purchase-path.ts`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/lib/catalogue/purchase-path.ts))
- [x] **Storefront & Portal Direct Buy UI**:
  - [x] Cart drawer & checkout supporting direct buy for in-stock products ([`cart-checkout.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/components/site/cart-checkout.tsx))
  - [x] Direct Buy modal panel on shared catalogs ([`CatalogBuyPanel.tsx`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/components/catalogs/CatalogBuyPanel.tsx))
  - [x] `place_direct_order` RPC creating confirmed sales order from cart
- [ ] **Stock Reservation & Payment Gateway Integration**:
  - [ ] Stock reservation ledger / TTL expiry
  - [ ] Razorpay / Stripe webhook settlement reconciliation
  - [ ] Payment status verification before final dispatch

---

### M6: Production Rollout, Domains & Operations
- [x] **Brand & Domain Consistency**:
  - [x] Centralized brand definitions in [`src/lib/brand.ts`](file:///Users/ashutoshchoudhary/Documents/antigravity/hopeful-pythagoras/src/lib/brand.ts)
  - [x] Production site URL: `https://www.giftingstore.online`
  - [x] Company portal subdomains: `https://{portal_slug}.giftingstore.online` via Vercel wildcard
- [x] **Tenant Routing & Security**:
  - [x] `src/proxy.ts` host resolution isolating apex/CRM vs company tenant subdomains
  - [x] Supabase Auth redirect URLs and password reset host verification
- [x] **Error Handling & Navigation**:
  - [x] Dedicated Next.js error boundaries for root, `/crm`, and `/portal`
  - [x] `BackButton` integration with `NavHistoryTracker`
- [ ] **Telemetry & Production Verification**:
  - [ ] End-to-end UAT sign-off across all roles (Admin, Sales, Ops, Accounts, Client)
  - [ ] Structured error alerts and operational health dashboards

---

## 🔄 Checklist Maintenance Rules
1. **Immediate Updates**: Whenever code, database migrations, tests, or features are added or modified, update this document and mark tasks accordingly.
2. **Verification First**: Mark items complete (`[x]`) only when verified by unit tests, build validation, or confirmed migration scripts.
3. **Traceability**: Link relevant code files, tests, and migrations for any new or modified items.
