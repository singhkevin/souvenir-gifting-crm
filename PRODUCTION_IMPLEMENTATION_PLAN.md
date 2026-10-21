# Souvenir production implementation plan

Prepared 3 October 2026. Status: proposed delivery plan, based on the supplied draft and local repository inspection. No application code, accounts, infrastructure, or production data were changed during planning.

The target is one complete journey: curate and share a client catalog → receive an inquiry → compare supplier costs → issue a quotation → accept selected items → create exactly one order → procure, approve proofs, produce, dispatch, and deliver. Stock-backed direct purchasing is an additional required journey and needs its own checkout implementation.

## 1. What the repository changes about the draft

| Finding | Evidence in repository | Delivery consequence |
| --- | --- | --- |
| Manual product addition and budget-generated kits already exist. | `src/app/crm/campaigns/actions.ts` | Extend the builder with filtered multi-select and reuse; preserve kit behavior. Do not treat curation as a rebuild. |
| The public cart submits quote requests. | `src/components/site/cart-drawer.tsx`, `src/lib/catalogue/cart.ts` | A Buy button alone does not implement direct purchasing. Checkout, stock reservations, order confirmation, and payment/settlement rules are required. |
| Current “margin” pricing actually uses cost × (1 + percentage). | `src/lib/pricing/resolve.ts` | Introduce explicit markup versus gross-margin semantics. Never silently reinterpret existing percentages. |
| Accept/reject and order conversion are separate operations. | `20261003_quotation_response.sql`, `src/app/crm/quotations/actions.ts` | Make selected-item acceptance and conversion atomic, with safe retries and authorization inside the database. |
| The checked-in conversion copies eligible products but retains the full quotation total and derives costs from current products, including an estimated fallback. | `20260909_convert_order_active_catalogue_only.sql` | Recompute accepted totals from frozen quotation lines and confirmed cost snapshots. Never silently omit selected lines or present guessed costs as confirmed profit. |
| Acceptance currently rejects sibling quotations for the same requirement. | `20261003_quotation_response.sql` | Define revision versus alternative quotation behavior before partial acceptance ships. |
| Tenant hosts, provisioning, redirects, and suspension logic already exist. | `src/lib/portal-host.ts`, `src/lib/portal-hosts/`, `src/proxy.ts` | Extend and test the current domain system; avoid replacing it with a second provisioning system. |
| The operational migration is a comment-only record of a remote change; the complete stage RPC definition is not present in the inspected migrations. | `20260903_operational_crm_control_center.sql` | Obtain a schema-only baseline and reconcile actual functions, policies, enums, triggers, and grants before new migrations. |
| Migration apply order stops before the quotation-response migration. | `supabase/migrations/APPLY_ORDER.md` | Reconcile the manifest with deployed state; do not assume a file exists means it is applied. |
| No test script or CI workflow was found in the inspected repository. | `package.json`; no `.github` directory | Establish automated database and browser checks before transactional changes. |
| Shared demo credentials are documented. | `README.md` | Verify whether those identities are active in production; rotate/disable exposed access through the operator and keep test identities in staging. Do not copy credentials into new documentation. |

These are source observations, not a live production audit. Hosting, DNS ownership, deployed schema, provider configuration, backup capability, and production data quality remain unverified. The bundled Next.js data-security and production-checklist guides were read for this plan; implementation must also read the relevant installed guides for each changed API.

## 2. Product decisions and proposed defaults

Resolve these during kickoff, before their dependent work starts. They do not prevent database reconciliation or catalog UI preparation.

| Decision | Proposed default | Owner / blocking milestone |
| --- | --- | --- |
| Catalog terminology and routes | “Client Catalogs” at `/crm/catalogs` and `/portal/catalogs`. Keep the general product browser at `/catalogue` and `/portal/catalogue`. Redirect old campaign URLs while retaining underlying table names initially. | Product / catalog release |
| Public share URL | One canonical route, `https://souvenirgifting.com/share/[token]`. A separate catalog subdomain can redirect here if needed. | Product + platform / sharing |
| Portal domain | Confirm `giftingstore.online` versus the draft's `gogiftingstore.online`. Keep portal root and primary application origin as separate settings. | Business + platform / domain rollout |
| Workflow count | Eight statuses: confirmed → procurement → mockup crafting → client approval → production → packaging/QC → dispatched → delivered. Describe this as confirmation plus seven fulfillment stages. Cancellation remains separate. | Operations / workflow schema |
| Client authority | Client admins approve quotations and proofs; client users shortlist and inquire unless explicitly delegated approval authority. | Business / acceptance and proofs |
| Partial acceptance | One final decision per quotation version. Selected lines become accepted; unselected lines become rejected. Further purchases require a new revision/quotation. Whole-line quantities only for the first release. | Sales / acceptance |
| Purchase orders | Client acceptance creates a sales order and approval record. Capture a buyer PO reference/upload where needed; create supplier procurement POs separately. Do not label a sales order as a buyer-issued PO. | Sales + procurement / acceptance |
| Kit acceptance | An offered kit is an indivisible selectable group unless explicitly authored as separate saleable products. | Sales / quote model |
| Margin and price filtering | Filter by target-company selling price, with a clear before-tax label. New quotation target margin means gross margin; preserve existing catalog markup behavior under an explicit label. | Sales + accounts / costing |
| Direct-buy settlement | Confirm prepaid payment provider versus an approved credit/COD order flow, plus shipping, tax, cancellation, and refund rules. Never confirm a prepaid order from a browser success redirect alone. | Business + accounts / checkout |
| Workflow exceptions | Unbranded products can skip proof/printing only through an explicit authorized transition with a reason. Define who can cancel, reopen, and override. | Operations / workflow |
| Portal provisioning eligibility | Provision manually for approved clients initially; do not hard-code the draft's annual-volume threshold without agreement. | Business / domains |

## 3. Delivery sequence and milestones

Planning estimate: **9–12 calendar weeks for two engineers with part-time QA and an available product/operations owner**, including checkout and release contingency. A single engineer should plan roughly 16–22 weeks. These are provisional estimates, not a committed date; re-estimate after the schema audit and checkout decision. Provider onboarding and unresolved business decisions can extend elapsed time.

| Milestone | Indicative window | Scope and dependency | Exit condition |
| --- | --- | --- | --- |
| M0 — Reproducible baseline | Week 1 | Schema reconciliation, staging, decision log, baseline checks, monitoring plan | Clean staging rebuild succeeds; existing portal/CRM smoke checks pass; critical policies/functions are recorded |
| M1 — Catalog authoring | Weeks 2–3 | Naming, compatibility redirects, filtered multi-select, atomic cross-company clone; depends on M0 | Sales can curate 10–50 products and reuse kits without carrying another client's private data or pricing |
| M2 — Sharing and PDF | Weeks 3–4 | Published revisions, expiring/revocable links, inquiry intake, branded PDF; depends on M1 | Mobile anonymous review works; revocation and expiry deny access; PDF passes visual review |
| M3 — Costing and acceptance | Weeks 4–6 | Supplier comparisons, cost snapshots, versioned quotes, selected-item acceptance, sales order and procurement PO support; depends on M0/M1 | Partial approval creates exactly one accurate order; concurrency and tenant-isolation tests pass |
| M4 — Fulfillment | Weeks 6–8 | Proof revisions/sign-off, guarded transitions, handoffs, order UI, reporting; depends on M3 | A pilot order completes the new workflow with recorded evidence and assignments |
| M5 — Direct purchasing | Weeks 4–8, alongside sales work if staffing permits | Product controls, stock ledger/reservations, checkout, settlement and reconciliation; depends on M0 and commercial decisions | End-to-end purchase, stock contention, timeout, cancellation, and settlement tests pass |
| M6 — Production rollout | Weeks 9–10, with up to 2 weeks contingency | Domain validation, migration rehearsal, UAT, pilot and staged enablement; depends on all required milestones | Signed release gates, successful pilot, reconciled transactions, and handover |

Catalog improvements may ship earlier behind controlled enablement. The complete project is not done until all draft requirements, including PDFs and direct purchasing, pass their release gates. Do not promise the draft's unspecified “Thursday” delivery date.

## 4. Implementation work packages

### M0: Database and delivery foundation

1. Record the deployed application revision and reconcile production schema metadata with the repository through authorized read-only access. Capture missing base tables, enums, RLS policies, storage policies, function bodies, execute grants, and triggers without exporting customer data.
2. Create a reproducible baseline for fresh environments and an explicit migration ledger. Preserve historical migration evidence; do not rerun baseline creation on an existing database. Add the quotation-response migration to documented ordering after checking its deployed state.
3. Create an isolated staging database and deployment using synthetic companies, products, quotes, supplier costs, and orders. Include two unrelated clients plus sales, operations, accounts, and admin users. Use individual invitations or generated credentials; send no invitations during planning.
4. Establish lint, TypeScript checks, production build, database integration tests, and browser smoke tests in CI. Record and fix release-blocking baseline failures rather than burying them in feature changes.
5. Introduce server-enforced feature flags for catalogs, sharing, partial acceptance, workflow v2, and direct buy. Flags control writes as well as UI visibility. Add structured error reporting and correlation IDs without storing share tokens, credentials, or private prices in public telemetry.
6. Add a deployment checklist covering environment separation, backup/restore evidence, migration locking/timeout limits, and named release and incident owners.

### M1: Catalog authoring and reuse

- Rename UI, navigation, breadcrumbs, notification links, and routes. Retain `campaigns` and `campaign_products` internally for the initial release; a physical database rename has no customer benefit here. Keep old deep links functional with server redirects and verify tab-session navigation.
- Extend the current editor with accessible min/max price inputs and a slider, search/category filters, pagination, selected-count display, and bulk add/remove. Define unit price versus full-kit price explicitly. Keep selections stable when filters change and validate all submitted IDs server-side.
- Implement clone as a transaction: validate access to source and target companies, copy descriptions, ordering and kit structure, regenerate catalog/kit identifiers, and create a draft owned by the initiating staff member.
- Do not copy share tokens, client selections, acceptance events, supplier-private notes, or publication state. Recalculate target-company prices; require an explicit permitted override to retain negotiated prices.
- Check target-company exclusions and product grants. Return a reviewable list of unavailable items and require an explicit choice before producing a reduced clone; never silently grant product access or split kits.
- Make bulk creation atomic and retry-safe. Account for the existing unique catalog/product relationship when cloning and generating kits.

### M2: Public sharing, inquiry intake, and PDF

- Publish a client-safe catalog revision so a shared presentation has stable prices and kit composition. Staff previews show drafts; public links resolve only a published revision. Define republishing as a new revision with deliberate link rotation or retargeting.
- Add a share record with catalog revision, cryptographically random token digest, creator, creation time, expiry (30 days by default), revocation time, and allowed purpose. Store the raw token only in the generated link, not application logs.
- Validate the token, expiry, revocation, tenant status, and publication state on every page, inquiry, image/document authorization, and PDF request. Expiry enforcement must not depend on a scheduled cleanup job.
- Return only approved display fields. Never expose supplier identities/costs, internal margins, other company records, or unrestricted database reads. Test responses and serialized component data, not just visible UI.
- Public access is possession-based: anyone with the link can view that approved revision. Display this clearly to staff. Apply no-index metadata, restrictive referrer handling, and prevent shared caches/service workers from retaining protected content after revocation.
- Build an inquiry form with validated product/kit IDs, quantities, contact information and deadline. Attach the catalog revision and originating company internally; rate-limit and deduplicate intake. A public link must not authorize quotation acceptance or change client contacts automatically.
- Generate a branded presentation PDF from the same safe revision: cover, product images, kit contents, prices where permitted, delivery notes, and contact details. Bound image size, document size and generation time; use an async job if deployment limits require it. Restrict renderer asset fetching to approved sources.
- Verify 1-, 10-, and 50-item PDFs, long names, missing images, page breaks, and mobile download. Downloaded copies cannot be revoked; link expiry only prevents future retrieval.

### M3: Supplier costing, quotations, and acceptance

**Costing model**

- Add product-supplier associations and supplier-offer records with SKU/category match, quantity/MOQ, unit cost, currency, availability, lead time, validity, recorded-by, and timestamp. Distinguish a historical benchmark from a current confirmed offer.
- Allow 3–4 supplier offers per line in the quote builder, with a selected offer and override reason. Snapshot the selection and costs onto the quotation version. Support different suppliers across lines; the current single order-level supplier field is insufficient for procurement.
- Include product, branding, packing, and freight components in expected cost where known. Display incomplete costing explicitly and block “confirmed margin” claims until required costs exist.
- Gross margin uses `sell = cost / (1 - margin / 100)`; ₹420 at 25% gives ₹560. Markup uses `cost × (1 + percent / 100)`; the same inputs give ₹525. Preserve old values and record the pricing method on new quotations. Validate the gross-margin range below 100% and use consistent currency rounding.
- Centralize before-tax revenue, discounts, tax, freight and rounding calculations. Accounts signs off the business calculation examples, including allocation of quote-wide discounts and fixed charges after deselection. Calculate gross profit from before-tax revenue and snapshotted costs, not tax-inclusive receipts.

**Acceptance contract**

- Use immutable issued quotation versions, per-line decision states (`pending`, `accepted`, `rejected`), selected supplier/cost snapshots, and source-line IDs on resulting order lines. Editing an issued quote creates a revision.
- Portal UI selects lines or whole kits, previews authoritative totals, and requires at least one selection. Keep quantity negotiation in “Request changes” for the first release. Show a confirmation with accepted items and the new order reference.
- Implement one authenticated acceptance RPC (or equivalent transactional function) accepting quotation ID, version, accepted line IDs, buyer PO reference if required, and an idempotency key. Keep generic internal conversion logic inaccessible to anonymous callers.
- Inside the transaction: verify active profile, company/role/approval authority, quote state and expiry; lock the quotation and related revision/requirement records in a stable order; reject empty, duplicate, foreign, or stale IDs; enforce kit completeness; calculate totals from stored terms; record decisions and approval; create order/items, assignment, audit events and initial task together.
- Add a database uniqueness constraint on the source quotation/version for the one-order policy. Repeated identical acceptance returns the same order; a conflicting repeat returns a clear conflict. Two simultaneous approvals must not create two orders.
- Revalidate product eligibility before commit. If an accepted line is no longer fulfillable, reject the whole transaction and request requotation; do not silently drop it while retaining the original total.
- Set initial status to `order_confirmed`, record the approval event, and route the work queue to procurement. Do not invent a delivery date by always adding 21 days; require a confirmed date or explicitly show it as pending.
- Distinguish superseded revisions from independent alternative offers. Prevent concurrent acceptance of mutually exclusive alternatives; stop blanket rejection of unrelated sibling offers. Record whether the originating requirement is partially or fully won without assuming rejected lines have been fulfilled.
- Retire or safely wrap old acceptance/conversion entry points so they cannot bypass selection rules. Historical accepted quotes without orders require a staff-reviewed backfill path; never infer missing decisions from current product visibility.
- Queue external email notifications after commit using an outbox with retries/deduplication. Notification failures must not undo or duplicate an accepted order.

**Purchase-order support**

- Keep customer PO evidence, sales order confirmation, and supplier POs distinct. Group accepted order lines by winning supplier, create supplier PO drafts with immutable cost/quantity snapshots, and record approval, issue time and receipt of goods.
- Support multiple supplier POs per order, partial receipts and cancellation adjustments. Printing vendor assignments remain separate. Automatic emails/integrations can follow the initial document-and-status workflow; manual issuance must be auditable.

### M4: Fulfillment and proof approval

Introduce a workflow version so in-flight orders can continue on the old lifecycle while new orders use v2. This is safer than automatically moving old production orders backwards into a newly required proof stage.

| V2 status | Queue | Required evidence before next transition |
| --- | --- | --- |
| `order_confirmed` | Procurement | Approved order, delivery commitment or explicit pending-date exception, sourcing owner |
| `procurement` | Procurement | Supplier PO assignments and blanks/material readiness |
| `mockup_crafting` | Printing / operations | Branding vendor and uploaded, versioned proof or authorized unbranded exception |
| `client_approval` | Sales / operations | Named authorized client approves the current proof version; rejection routes back to mockup work |
| `printing_production` | Printing | Production completion evidence for approved design and quantities |
| `packaging_qc` | Operations / quality | QC result, packed quantities, resolved defects, dispatch readiness |
| `dispatched` | Logistics | Courier, tracking reference, dispatched quantity/date; delivery confirmation closes this stage |
| `delivered` | Accounts | Delivery evidence and accounts handoff; invoicing/payment remain a separate lifecycle |

- Enforce transitions in the database with current-state/version checks. Require assignee/department, due date for active stages, relevant partner, and handoff remarks in one transaction. Validate assignee membership and active status.
- Model proof revision, storage object, shared timestamp, approver, decision and comment. Approving an outdated proof fails; replacing an approved proof invalidates production authorization until reapproved. Anonymous catalog links never authorize proof approval.
- Define rework, blocked status, cancellation, and authorized exception paths. Preserve original stage history; never rewrite it to make legacy orders appear to have completed approvals they did not complete.
- Update `src/lib/order-workflow.ts`, the stage RPC, order actions, Kanban, detail pages, portal timeline, department queues, tasks, notifications, health calculations, and reports together. Verify that department slugs exist, including quality.
- Track partial receipts and shipments as child records if an order splits across suppliers/destinations. Parent order reaches delivered only when all required quantities are delivered or explicitly cancelled. If this is not implemented for launch, formally limit the pilot to single-shipment orders.
- For legacy orders, default to workflow v1 completion. Offer an audited per-order v2 conversion with preview and explicit mapping only where necessary. Never guess how an ambiguous `in_progress` order should map.

### M5: Stock-driven storefront and real direct purchasing

- Add `allow_direct_buy` and `allow_rfq`, with conservative defaults: existing products remain RFQ-capable and direct buy disabled until stock and commercial terms are verified.
- Maintain physical stock, reserved stock, and available-to-promise quantity using a transactional inventory ledger/reservation model. Sample inventory is not saleable inventory. Expose a safe availability result to the storefront instead of supplier stock details.

| Context | Buy eligible and sufficient available stock | Otherwise |
| --- | --- | --- |
| Public storefront | Add to purchase cart, subject to quantity/MOQ/terms validation | RFQ if allowed; otherwise show unavailable |
| Corporate portal | RFQ/shortlist by default unless company buying is explicitly enabled | RFQ if allowed; otherwise show unavailable |

- Remove the customer-facing B2B/B2C switcher wherever present, while preserving internal channel/company pricing resolution. Server context determines price; a browser field cannot select a cheaper channel.
- Separate purchase and quote-request carts. Revalidate product eligibility, stock, price, quantity/MOQ and delivery charges at checkout; never trust local-storage prices.
- For prepaid purchases, create a pending checkout and expiring stock reservation, then finalize via verified provider settlement with unique provider-event IDs. Handle duplicate/delayed/out-of-order events, failed payment, reservation expiry, late payment after expiry, refunds and cancellation without overselling or duplicating orders.
- For approved credit/COD, implement the agreed authorization and outstanding-balance/order rules explicitly. A payment provider is unnecessary only if the chosen commercial flow does not require it.
- Provide customer confirmation, order lookup/access controls, internal fulfillment routing, receipts and daily settlement reconciliation. Do not enable Buy until the complete selected flow works in staging and production smoke checks.

### Domain and infrastructure work across milestones

- Keep `souvenirgifting.com` as the planned main origin and the confirmed portal root as a separate configuration. Update `mainOrigin()` behavior deliberately: it currently derives the main origin from `ROOT_DOMAIN`.
- Verify actual hosting topology; the repository mentions Vercel and also contains Hostinger integration. Record which system terminates TLS, serves the app, and provisions tenant hosts before changing DNS.
- Reuse portal-host jobs and redirect history. Test reserved/unknown hosts, expired trials, suspended tenants, slug changes, origin validation, password recovery, company-host mismatches, and simultaneous tab-isolated sessions.
- Configure certificates, DNS, authentication callback URLs, canonical URLs, trusted application origins, and transactional email links. Restrict callbacks and host acceptance to intended origins.
- Rehearse the primary-domain cutover separately from business migrations. Keep a verified previous origin available during transition; only publish company portal URLs after their host checks pass.

## 5. Migration and compatibility strategy

1. **Expand:** Add tables, nullable columns, constraints after data audits, versioned functions and workflow identifiers. Review function execute grants and RLS for every new object. Harden `SECURITY DEFINER` functions with a fixed search path and explicit authorization.
2. **Deploy compatible application:** New code can read legacy and new records with writes controlled by flags. Keep old routes redirected and prevent stale clients/old RPCs bypassing new rules. Verify a rollback-compatible application build exists.
3. **Backfill and reconcile:** Use bounded, repeatable batches and record counts before/after. Audit duplicate quotation orders before adding uniqueness constraints; quarantine discrepancies for review. Preserve historical prices, taxes, statuses and invoices.
4. **Enable pilot:** New workflows apply only to selected companies/new records. Confirm sums, decisions, assignments and stock after each pilot transaction.
5. **Contract later:** Remove obsolete functions, flags or columns only after usage is zero and the rollback window closes. Do not combine destructive cleanup with launch.

Every migration PR includes preconditions, lock/runtime expectations, verification SQL, failure handling, and a recovery procedure. After new-format records exist, prefer disabling new writes and rolling forward; a destructive down migration can lose customer decisions. Existing orders must remain readable and operable during rollback. Backup restore is reserved for a verified recovery incident and must account for later transactions and payment-provider reconciliation.

Production migration execution remains an operator release step, consistent with `supabase/migrations/APPLY_ORDER.md`. This document is a plan, not authorization to apply migrations.

## 6. Verification and release gates

| Area | Required evidence |
| --- | --- |
| Regression | Lint/type checks/build pass; login/recovery, company catalog visibility, quotations, orders, invoices and existing tenant routes pass browser smoke tests |
| Tenant boundaries | Client A cannot read/mutate client B catalog, quote, order, proof or PDF, including forged IDs, direct RPC calls, host mismatch and stale sessions; public responses contain no cost/margin fields |
| Catalog | Price boundaries, company pricing, 50-item selection, duplicate submissions, atomic clone, kit structure and unavailable-product review pass |
| Sharing | Valid, expired, revoked, malformed and brute-force tokens handled correctly; no cached access after revocation; inquiry retries do not create duplicate records |
| Costing | ₹420/25% examples distinguish markup and margin; multiple suppliers, expired offers, discounts, rounding, freight and missing-cost states verified |
| Acceptance | Zero/all/subset selections, foreign IDs, whole kits, expired and revised quotes, simultaneous clicks, network retry and rollback on failure tested against a real test database |
| Financial consistency | Accepted order totals equal server-calculated accepted terms; unselected lines excluded; before-tax expected profit matches frozen costs; old invoices unchanged |
| Workflow | Required handoffs enforced even through direct RPCs; stale proof rejected; rework and cancellation work; two operators cannot double-advance; legacy orders remain usable |
| Direct buy | Last-unit race, excess quantities, changed prices, reservation expiry, duplicate/late payment events, cancellation/refunds and reconciliation pass |
| Experience | Keyboard/mobile operation, understandable errors, safe retry states, 1/10/50-item PDF review and representative catalog performance checked |
| Operations | Fresh staging rebuild, migration rehearsal, rollback drill, backup recovery evidence, alerts, runbooks and named support owner available |

Use unit tests for calculations and eligibility; database integration tests for authorization, concurrency and transactions; browser tests for the full journeys. Mock-only transaction tests are insufficient. Set performance targets after measuring the baseline; proposed pilot targets are p95 ordinary reads under 2 seconds and database-backed submissions under 3 seconds, excluding document generation and external-provider latency.

UAT owners: sales/product for catalogs and quotations; procurement/operations for supplier POs and fulfillment; accounts for totals and settlement; client representative for review/approval. Obtain recorded sign-off for each journey and resolve all critical/high-severity defects before launch.

## 7. Production rollout and support

1. **Preflight:** Freeze release scope, confirm backup/recovery readiness and applied migration ledger, record release SHA, rehearse staging migration and rollback, verify flags off, and confirm support coverage.
2. **Deploy:** Apply additive schema changes, deploy compatible code, then run CRM/portal/public-route smoke checks with controlled test records. Verify no unexpected financial or inventory changes.
3. **Pilot:** Enable one internal team and one approved client. Complete catalog → RFQ → partial acceptance → order, plus proof approval and a controlled direct purchase. Allow 3–5 business days of active usage; do not treat a timer alone as successful validation.
4. **Expand:** Enable a small set of companies, then the rest after at least 48 hours of stable observed usage at each step. Domain cutover uses its own verified checklist.
5. **Monitor:** Track acceptance/conversion failures and duplicates, quote/order amount discrepancies, denied tenant access, share/PDF errors, payment failures and unreconciled settlements, negative available stock, outbox retries, failed stage transitions, and portal provisioning failures.
6. **Stop conditions:** Any cross-company exposure, duplicate order/charge, unexplained total mismatch, negative stock, or missing approval evidence stops the affected feature immediately. Proposed service trigger: submission errors above 1% over 15 minutes with at least 20 attempts, or repeated failures on a core low-volume flow, triggers investigation and paused expansion.
7. **Recover:** Disable affected new writes, preserve successful transactions and audit records, reconcile with database/provider state, and deploy the rehearsed compatible build or corrective migration. Domain issues revert through the separate DNS/host runbook. Release owner coordinates recovery; accounts reconciles money and inventory.
8. **Handover:** Deliver updated architecture, migration/apply notes, support runbooks, user instructions, role matrix, known limitations and release notes. Hold a two-week stabilization window before removing compatibility paths.

## 8. First implementation tickets

1. **P0 — Capture and reconcile database baseline.** Deliver missing schema/function/policy definitions, deployed-versus-repo report, and a successful fresh staging rebuild.
2. **P0 — Record product contracts.** Resolve domain spelling, approval authority, stage vocabulary, partial-selection semantics, margin basis, PO meaning and direct-buy settlement.
3. **P0 — Establish CI and synthetic UAT data.** Deliver repeatable build checks and tenant-isolation/quote conversion smoke tests, including a documented current baseline.
4. **P1 — Catalog routes and authoring.** Deliver redirects, accessible price filters, bulk selection and atomic clone with target-company eligibility checks.
5. **P1 — Sharing and PDF.** Deliver published revisions, safe token access, inquiry intake, revocation and reviewed branded exports.
6. **P1 — Costing and transactional acceptance.** Deliver supplier offers, explicit margin calculations, selected-item approvals, one-order constraint, procurement drafts and adversarial tests.
7. **P1 — Fulfillment v2.** Deliver proof approval, guarded transitions and complete operational/portal views while retaining legacy-order support.
8. **P1 — Stock and checkout.** Deliver an actual purchase flow with reservations, agreed settlement, reconciliation and correct Buy/RFQ behavior.
9. **P0 before release — Rehearsal and pilot.** Deliver recorded UAT, migration/recovery evidence, domain verification and go/no-go review.

Completion means all required journeys are usable in production, data remains consistent and company-isolated, monitoring and recovery are exercised, and business owners can operate the system without engineering intervention for normal work.
