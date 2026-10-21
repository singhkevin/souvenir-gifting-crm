# Stitch v2 Corporate Homepage Implementation Notes

## Summary
Implementation and refinement of the Stitch v2 contemporary Indian corporate gifting homepage redesign (`/business` route) matching design-ref and incorporating real catalogue data, indicative pricing workflows, and neutral placeholders for unverified claims. UI only; pricing engine (`src/lib/pricing`), database schema, authentication, server action logic, and environment configurations are strictly preserved.

---

## Route
- **Target Route:** `/business` (`src/app/business/page.tsx` rendering `src/components/site/business-home.tsx`).
- Does **not** affect retail root (`/`), client portal (`/portal`), or admin CRM (`/crm`).
- Compatible with authenticated corporate accounts (`getProfile` companyId path preserved).

---

## Files Changed & Created

### Design System & Scoped Assets
- `src/app/sv2.css`: Scoped CSS custom properties, typography utilities, scroll fade-in animations, pulse status dot, mobile sticky bar rules, and scoped `#catalog` integration styles. All rules are strictly scoped under `.sv2`.
- `src/lib/fonts.ts`: Font loaders via `next/font/google` (`Newsreader` for editorial display/headlines, `Plus_Jakarta_Sans` for body copy and UI labels, and `JetBrains_Mono` for data/SKU/prices/MOQ and placeholder tags) with `display: 'swap'`.
- `src/config/siteContent.ts`: Central client content configuration file holding all unverified claims, placeholder data, addresses, legal numbers, proof tiles, and stats, with `// TODO(client): ...` comments on every value.

### Shared SV2 Components (`src/components/sv2/`)
- `utility-bar.tsx`: Charcoal announcement bar with pulse dot, `[Dispatch note]`, `[Pan-India Courier]`, `[GST ITC Compliant]`, real phone fallback, and B2B MOQ note.
- `header.tsx`: Sticky cream header with brand logo, search bar, segmented `Retail | Business` switcher, `Register` and `Sign in` links, Sample Cart button, Request a Quote CTA, secondary category navigation row, and mobile drawer.
- `section-header.tsx`: Oversized mono numeral (`01`–`05`), editorial serif title, subtitle, and right-aligned link.
- `product-card.tsx`: Square product card with SKU row, stock badge, product photo, serif title, spec row, price, and MOQ chip.
- `kit-card.tsx`: Occasion kit card with 4:3 image, category tag, serif title, generic description, customisation note, starting price, MOQ, and configure link. Lead time omitted if not present in data.
- `bestseller-rail.tsx`: Interactive 5-column product rail with category filter tabs (`All Items`, `Executive Desk`, `Hydration`, `Gourmet Hampers`, `Eco & Sustainable`).
- `featured-kit-slider.tsx`: Hero right-column showcase card pulling strictly from live catalog data with pagination controls.
- `rfp-form.tsx`: Quotation request form linked to the existing `submitPublicQuote` server action, with honeypot spam protection, real phone fallback, and plain success text.
- `chip.tsx`: Rectangular 1px hairline border chip for MOQ and badges.
- `button.tsx`: Square-cornered button (`black`, `saffron`, `outline`, `outline-light`).
- `input.tsx`: Form input, select, and textarea primitives with sans-serif label typography.
- `placeholder-tile.tsx`: Neutral hairline-bordered linen box displaying placeholder text in muted mono.
- `fade-in.tsx`: Scroll fade-in container using `IntersectionObserver`, automatically disabled under `prefers-reduced-motion`.
- `footer.tsx`: 4-column footer with brand summary, GSTIN, CIN, addresses, real contact phone fallback, procurement links, legal compliance, and dynamic `© {year} {appName()}` copyright.

### Modified Files
- `src/app/business/page.tsx`: Scoped font variables and `.sv2` class wrapper on `/business`, with plain Indian-English SEO metadata (no jargon).
- `src/components/site/business-home.tsx`: Complete Stitch v2 corporate homepage structure, integrating live catalog data, indicative pricing notice with Register/Sign in links, 6 occasion kit cards, live bestsellers, filterable catalogue (`StorefrontCatalog`), partner brands row, why souvenir pillars, and fast-track RFQ form.
- `src/config/siteContent.ts`: Updated `whySouvenir` 4 verified claims, `utilityBar.dispatchStatus` placeholder, and preserved `// TODO(client): ...` comments.

---

## Placeholder Keys & Placement on Page

All placeholders are defined in `src/config/siteContent.ts` and rendered visibly without invented data:

| Key | Placeholder Value | Placement on `/business` Page |
|---|---|---|
| `utilityBar.dispatchStatus` | `'[Dispatch note]'` | Top charcoal utility bar (live pulse dot) |
| `utilityBar.shippingNote` | `'[Pan-India Courier]'` | Top charcoal utility bar |
| `utilityBar.gstNote` | `'[GST ITC Compliant]'` | Top charcoal utility bar |
| `phone` | `'[+91 XXXXX XXXXX]'` | Fallback phone used in utility bar, footer, and RFQ form when `getContactPhone()` returns null |
| `whatsapp` | `'[+91 XXXXX XXXXX]'` | Footer Address & Contact column |
| `email` | `'[Email]'` | Footer Address & Contact column |
| `stats.minimumOrder` | `'Minimum order ₹[X]'` | Top charcoal utility bar |
| `stats.dispatch` | `'[X]-hour dispatch'` | Hero quick SLA indicators (1st column) |
| `stats.pinCodes` | `'[X]+ PIN codes served'` | Hero quick SLA indicators (2nd column) |
| `stats.breakageCover` | `'[X]% breakage cover'` | Hero quick SLA indicators (3rd column) |
| `stats.quoteTurnaround` | `'Quotes within [X] hours'` | Mobile sticky bottom CTA bar |
| `stats.avgResponse` | `'Avg response [X] mins'` | Quotation consultation form header |
| `clientLogos` | 6x `'[Client logo 1..6]'` | Section 04: 6 neutral placeholder tiles with hairline borders and linen background |
| `caseStudies` | `[{ title: '[Case study: company, qty, cities]', ... }]` | Section 04: Neutral case study card with volume (`[X] kits`) and hub (`[City]`) stat boxes |
| `partnerBrands` | 5x `'[Partner brand 1..5]'` | Section 04: Rendered only if `getPublicBrands()` returns 0 brands; otherwise live brands are shown |
| `whySouvenir` | 4 verified capability points | Section 05: Four capability pillars (`01`, `02`, `03`, `04`) reflecting real platform capabilities |
| `gstin` | `'[GSTIN]'` | Footer Overview column & bottom integrity ledger line |
| `cin` | `'[CIN]'` | Footer Overview column |
| `registeredAddress` | `'[Registered address]'` | Footer Address & Contact column |
| `studioAddress` | `'[Studio address]'` | Footer Address & Contact column |
| `founderNote` | Placeholder text | Available in `siteContent.ts` (section hidden per plan until photo/copy provided) |

---

## Deviations & Adaptations from Design Reference
1. **No Invented Products:**
   - Hardcoded hero kits and fallback bestsellers arrays removed. Hero featured slider and bestsellers populate strictly from live catalogue data (`getBusinessCatalogue`) with real prices (`businessPrice`) and MOQ. If no live products exist, `PlaceholderTile`s labelled `'[Featured kit]'` / `'[Product]'` are rendered.
2. **Restored Filterable Catalogue:**
   - Section 03 embeds `<StorefrontCatalog basePath="/business" ... limit={8} />` with `readCatalogueFilters(searchParams)`, categories, brands, price filters, and MOQ captions, styled seamlessly under `.sv2`.
3. **Indicative Pricing Notice & Auth Links:**
   - Placed an indicative pricing notice bar at the hero/header boundary stating *"Prices shown are indicative. Your quotation is the final price."* alongside direct "Register" and "Sign in" links. Also added "Register" and "Sign in" to the desktop header and mobile drawer.
4. **Real Brand Links:**
   - In Section 04, real brands from `getPublicBrands()` are rendered linking to `/brands/[slug]` via `brandPath`. Neutral `siteContent.partnerBrands` tiles display only as a fallback if the database has zero brands.
5. **No Jargon & Plain Indian-English:**
   - Excluded buzzwords ("Atelier", "Enterprise Procurement Desk", "archival", "routed to our corporate accounts desk", "material specifications", "precision personalisation"). Page title is `${appName()} — Corporate gifts for teams and clients`. Copyright is `© {currentYear} {appName()}`.
6. **Strict Monospace Typography:**
   - Monospace font is restricted exclusively to prices, MOQs, SKUs, and bracketed placeholder tags. All headings, body copy, and navigation links use serif (`Newsreader`) or sans-serif (`Plus Jakarta Sans`).
7. **Real Contact Phone Integration:**
   - `getContactPhone()` (from env `PUBLIC_CONTACT_PHONE` or `org_settings.public_contact_phone`) is passed to `UtilityBar`, `SV2Footer`, and `SV2RfpForm`, falling back to `siteContent.phone` only if unconfigured.

---

## Build progress (resume tracker)
| Portal | Status | Commit |
|---|---|---|
| Design system + corporate homepage (/business) | DONE | 9c4fe31 |
| Retail store (/, /catalogue, PDP, cart, checkout, orders, about) | DONE | – |
| Business quote pages (/business/(portal)/*, register) | PENDING | – |
| Corporate client portal (/portal/*, /login, finder) | PENDING | – |
| Admin CRM (/crm/*) | PENDING | – |

Prompts used per portal: ~/Documents/sv2-logs/common.md + p3-retail.md / p4-business.md / p5-corporate.md / p6-admin.md (run via ~/Documents/sv2-logs/run.sh). Screenshots: ~/Documents/sv2-shots/<portal>/.

---

# Stitch v2 Retail Store Portal Implementation Notes

## Summary
Complete implementation of the Souvenir v2 (SV2) design system across the entire **RETAIL STORE** portal on branch `design/stitch-v2-corporate-home`. All retail routes, drawers, detail pages, category listings, and checkout flows have been restyled to contemporary Indian editorial luxury using SV2 tokens (cream `#FCF9F2`, linen `#F6F3EC`, charcoal `#1C1B1A`, saffron `#9E4300`, peach `#FFB690`, hairline `#CCC5BD`, and muted `#4A4640`), 1px hairlines, square corners, zero shadows, and strict typographic hierarchy (`Newsreader` serif headings, `Plus Jakarta Sans` body, and `JetBrains Mono` for prices/SKUs/data only).

All existing functionality, data fetching, server actions, cart drawer and cart-add endpoints, quotation flows, auth routing, audience toggle cookies, and pricing logic were strictly preserved.

---

## Route -> Stitch Reference Mapping

| Route / Surface | Stitch Reference | Implementation Files |
|---|---|---|
| `/` & `/home` (Storefront Home) | `design-ref/reference/retail-storefront.png` + `design-ref/reference/homepage-v2.png` + `design-ref/retail/home-mobile.png` | `src/app/page.tsx`, `src/app/home/page.tsx`, `src/components/site/public-home.tsx`, `src/components/site/retail-hero.tsx`, `src/components/site/stitch-product-card.tsx`, `src/components/site/stitch-sections.tsx`, `src/components/site/storefront-catalog.tsx` |
| Site Shell & Global Chrome | `design-ref/reference/homepage-v2.png` & `design-ref/reference/retail-storefront.png` | `src/components/site/site-shell.tsx`, `src/components/site/site-header.tsx`, `src/components/site/site-footer.tsx`, `src/components/site/audience-switch.tsx`, `src/components/site/category-icon-strip.tsx`, `src/components/site/whatsapp-button.tsx` |
| `/catalogue` (Product Browser & Filters) | `design-ref/retail/category-listing.png` | `src/app/catalogue/page.tsx`, `src/components/site/mobile-catalogue-filters.tsx`, `src/components/site/price-range-filter.tsx`, `src/components/site/catalogue-browser.tsx`, `src/components/site/site-product-card.tsx` |
| `/categories`, `/categories/[slug]` | `design-ref/retail/category-listing.png` | `src/app/categories/page.tsx`, `src/app/categories/[slug]/page.tsx` |
| `/collections`, `/collections/[slug]` | `design-ref/retail/category-listing.png` | `src/app/collections/page.tsx`, `src/app/collections/[slug]/page.tsx` |
| `/brands/[slug]` | `design-ref/retail/category-listing.png` | `src/app/brands/[slug]/page.tsx` |
| `/catalogue/[id]` (Product Detail Page) | `design-ref/reference/retail-pdp.png` + `design-ref/retail/product-detail.png` + `design-ref/retail/product-mobile.png` | `src/app/catalogue/[id]/page.tsx`, `src/components/site/quote-modal.tsx`, `src/components/site/quote-form.tsx` |
| Cart Drawer | `design-ref/retail/cart-drawer.png` + `design-ref/retail/cart-mobile.png` | `src/components/site/cart-drawer.tsx` |
| `/catalogue/checkout` (Quoted Checkout) | `design-ref/retail/checkout.png` | `src/app/catalogue/checkout/page.tsx`, `src/components/site/cart-checkout.tsx` |
| `/orders/[order_number]` (Order Tracking) | `design-ref/retail/order-tracking.png` | `src/app/orders/[order_number]/page.tsx` |
| `/about` (About & Contact) | `design-ref/retail/about-contact.png` | `src/app/about/page.tsx` |
| `/request-quote` | `design-ref/retail/about-contact.png` & SV2 tokens | `src/app/request-quote/page.tsx` |
| `/gift`, `/gift/[id]`, `/gift/layout.tsx` | SV2 tokens | `src/app/gift/layout.tsx`, `src/app/gift/page.tsx`, `src/app/gift/[id]/page.tsx`, `src/components/gifts/gift-chooser.tsx` |
| `/business/register` | SV2 tokens | `src/app/business/register/register-form.tsx`, `src/components/auth/password-field.tsx` |

---

## Files Changed

### Global Shell & Nav
- `src/components/site/site-shell.tsx`: Scoped with `.sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`, added top `UtilityBar` passing verified phone fallback, and wrapped children in clean layout.
- `src/components/site/audience-switch.tsx`: Rebuilt to display exact `"Retail | Business"` toggle (`Retail` active with `#000000` text on `#FCF9F2` on retail routes, `Business` active on `/business`), preserving cookie assignment.
- `src/components/site/site-header.tsx`: Sticky cream `#FCF9F2` header with 1px hairline `#CCC5BD`, logo, tagline divider, search input with `SEARCH` tag, account/auth links, CartDrawer toggle with count, and "Request a Quote" CTA.
- `src/components/site/category-icon-strip.tsx`: Refactored `compact` and `cards` variants with SV2 typography, hairline borders, and saffron `#9E4300` active indicators.
- `src/components/site/site-footer.tsx`: 4-column SV2 footer on linen `#F6F3EC` with hairline `#CCC5BD` borders, business details from `siteContent`, and all original links preserved.
- `src/components/site/whatsapp-button.tsx`: Restyled to square hairline badge token style.

### Home & Storefront Root
- `src/components/site/retail-hero.tsx`: Rebuilt hero with solid charcoal `#1C1B1A`, hairline borders `#7C766F`/`#CCC5BD`, Newsreader serif title with peach `#FFB690` accent word, 4-item stat strip with vertical hairlines, and SV2-styled `RetailHeroSlider` and `RetailHomeSkeleton`.
- `src/components/site/stitch-product-card.tsx`: Restyled with square corners, `#CCC5BD` hairlines, `#F1EEE7` image stage, Newsreader titles, JetBrains Mono prices (showing `"Price on quote"` when null), and square buttons.
- `src/components/site/stitch-sections.tsx`: Rebuilt `SectionHeading`, `RetailOccasionBento`, `BrandLogoRow`, and `ProductSection` using SV2 alternating cream/linen/charcoal bands.
- `src/components/site/public-home.tsx`: Integrated updated hero, occasion bento, bestsellers, brand alliances, under ₹999 rail, dark festive hampers rail, unboxing promise strip, and live catalogue.
- `src/components/site/storefront-catalog.tsx`: Restyled filters, search form, category/brand/price/occasion links, and card grid with SV2 tokens.

### Catalogue, Categories, Collections & Brands
- `src/app/catalogue/page.tsx`: Added charcoal editorial banner with mono kicker, updated desktop sticky sidebar filter links with saffron active indicator, restyled top search/sort bar with square corners and hairlines, and updated occasion pills.
- `src/components/site/mobile-catalogue-filters.tsx`: Created SV2 square bottom-sheet and triggers (`SV2MobileFilterTrigger`, `SV2MobileFilterSheetShell`, `SV2MobileFilterSheetOption`) with `#FCF9F2` background, eliminating rounded corners and shadows without affecting CRM/portal.
- `src/components/site/price-range-filter.tsx`: JetBrains Mono range numbers, hairline slider track, and saffron `#9E4300` active range.
- `src/components/site/site-product-card.tsx`: Square corners, hairline `#CCC5BD`, Newsreader title, mono price (`"Price on quote"` when null), and square quick add button.
- `src/components/site/catalogue-browser.tsx`: Restyled list/grid view toggles and list view items.
- `src/app/categories/page.tsx` & `src/app/categories/[slug]/page.tsx`: Restyled category cards and detail header with SV2 tokens.
- `src/app/collections/page.tsx` & `src/app/collections/[slug]/page.tsx`: Restyled gift programmes grid and corporate moments occasion cards.
- `src/app/brands/[slug]/page.tsx`: Applied SV2 brand hero with verified brand alliance banner.

### Product Detail Page (PDP)
- `src/app/catalogue/[id]/page.tsx`: Rebuilt 2-column layout matching `reference/retail-pdp.html` with breadcrumbs, studio image stage, 3-up gifting perks (signature packaging, transit cover, direct gifting), Newsreader serif title, price and tax box with mono price (`"Price on quote"` when null), specifications table (`SKU`, `Availability`, `MOQ`), and SV2 action buttons.
- `src/components/site/quote-modal.tsx`: Restyled modal dialog with `.sv2` styling, square corners, `#CCC5BD` borders, and `#FCF9F2` fill.
- `src/components/site/quote-form.tsx`: Rebuilt input fields, labels, submit button, and success state while strictly preserving all existing form field names and submission actions.

### Cart Drawer, Checkout & Orders
- `src/components/site/cart-drawer.tsx`: 480px slide-over drawer matching `retail/cart-drawer.html` with kicker, Newsreader title, in-stock badge, shipping note, square product items with stepper (`[-] {qty} [+]`), JetBrains Mono pricing, subtotal, and trust badges.
- `src/components/site/cart-checkout.tsx`: Rebuilt input fields and submit button to square SV2 styling, keeping `checkoutStoreCart`, `checkoutQuotedOrder`, and idempotency logic intact.
- `src/app/catalogue/checkout/page.tsx`: Rebuilt quoted checkout page matching `retail/checkout.html` with 3-stage progress bar (`01 Delivery / 02 Review & Confirmation / 03 Dispatch`), 2-column layout (form on left, order summary card on right), and clear unavailable state.
- `src/app/orders/[order_number]/page.tsx`: Wrapped in `SiteShell`, restyled matching `retail/order-tracking.html` with order hero strip, 5-stage consignment trajectory stepper (`Placed` → `Packed & Sealed` → `In Transit` → `Out for Delivery` → `Delivered`), courier card with tracking number and expected delivery, and item specifications list.

### About & Public Forms
- `src/app/about/page.tsx`: Rebuilt matching `retail/about-contact.html` with charcoal architectural hero banner (`Gifting, crafted in India.`), studio disclosure spec sheet, 3 methodology pillars (`01 Selection`, `02 Sourcing`, `03 Customisation`), neutral physical studio cards (studio placeholders from `siteContent`, direct phone fallback), and direct consultation desk.
- `src/app/request-quote/page.tsx`: Charcoal banner, 3-step expectation list, selected gift highlight card, and square `QuoteForm`.
- `src/app/business/register/register-form.tsx` & `src/components/auth/password-field.tsx`: Square SV2 form card, hairline inputs, and support for custom `className`.
- `src/app/gift/layout.tsx`, `src/app/gift/page.tsx`, `src/app/gift/[id]/page.tsx`, `src/components/gifts/gift-chooser.tsx`: Scoped with `.sv2` font variables, square selection tiles, hairline borders.

---

## New `siteContent` Keys

Added to `src/config/siteContent.ts`:

| Key | Placeholder Value | Where Displayed |
|---|---|---|
| `retail.packagingNote` | `'[Gift packaging on all orders]'` | PDP gifting perks strip & Cart Drawer trust notes |
| `retail.studio1` | `'[Studio 1]'` | `/about` physical studio card 1 title |
| `retail.studio1Address` | `'[Studio 1 address]'` | `/about` physical studio card 1 address |
| `retail.studio2` | `'[Studio 2]'` | `/about` physical studio card 2 title |
| `retail.studio2Address` | `'[Studio 2 address]'` | `/about` physical studio card 2 address |
| `retail.openingHours` | `'[Opening hours]'` | `/about` studio cards opening hours |
| `retail.dispatchCities` | `'[Dispatch locations]'` | Hero 4-item stat strip |

---

## Deviations & Adaptations
1. **Plain Indian-English (Banned Words Removed):**
   - Reference HTML contained buzzwords like "atelier", "enterprise protocol", "archival", and "masterworks". These were systematically replaced with "studio", "workshop", "signature", or "gifts".
2. **Dynamic Live Data over Invented Reference Artifacts:**
   - Instead of hardcoding dummy products or guild names from the static design references, all cards, categories, brands, and Rails render live database items with real images and prices. Where a price is null, it shows `"Price on quote"` (never ₹0 or blank).
3. **No Cross-Portal Style Leaks:**
   - The `.sv2` wrapper was applied at `SiteShell` and `GiftLayout` so that CRM (`/crm`) and tenant client portals (`/portal`) remain completely unaffected. Components shared with CRM/portal (e.g. `mobile-filter-sheet.tsx`, `password-field.tsx`) were not destructively altered; instead, dedicated SV2 variants or optional style overrides were used.
4. **Verification:**
   - `npm run typecheck`: Passed (0 errors)
   - `npm test`: Passed (101 / 101 tests pass)
   - `npm run build`: Passed (clean production build)

---

## Retail cleanup

Cleanup pass on the uncommitted retail restyle:
- Removed unverified claims: no invented cities (Mumbai/Bengaluru/Delhi/Jaipur/Kanpur/Moradabad/Sanganer removed from prose), no invented founding years or studio scope descriptions, no fabricated guarantees ("100% Transit Safe", "zero-breakage guarantee", "256-bit", "white-glove guarantee"), no fabricated courier brand ("Pan-India Express Logistics" replaced with neutral fallback "Courier to be assigned"), and no SLA / turnaround promises ("within two hours" removed).
- Removed marketing buzzwords ("bespoke", "curation/curations", "artisan", "archive", "concierge", "editorial curation") in favor of plain Indian-English.
- Eliminated monospace overuse: section numerals and pseudo-terminal `// ... //` eyebrow/label styling changed to plain sans-serif uppercase tracking labels. Monospace is restricted exclusively to prices, MOQs, SKUs, order numbers, and bracketed placeholder tags.
- Studio cards and layout claims now use neutral bracketed placeholders from `src/config/siteContent.ts`:
  - `retail.packagingNote`: `'[Gift packaging on all orders]'`
  - `retail.studio1`: `'[Studio 1]'`
  - `retail.studio1Address`: `'[Studio 1 address]'`
  - `retail.studio2`: `'[Studio 2]'`
  - `retail.studio2Address`: `'[Studio 2 address]'`
  - `retail.openingHours`: `'[Opening hours]'`
  - `retail.dispatchCities`: `'[Dispatch locations]'`


### Retail final check (executor)
- Removed remaining hardcoded claims: "Gift box/packaging included" badges (about, orders, cart drawer, checkout, home), "Pan-India delivery INCLUDED" and "Incl. all GST" in cart/checkout totals, "Discreet packaging with zero invoices", "PAN-INDIA FULFILMENT" chips, home "Souvenir Promise" copy → siteContent placeholders.
- New key: `retail.directDispatchNote` = '[Direct-to-recipient dispatch details]' (TODO(client)).
- Fixed 390px overflow on /catalogue/checkout progress strip (flex-wrap).
- typecheck ✓, tests 101/101 ✓, build ✓. Screenshots 1440/390: home, category, product, checkout, about, catalogue — no horizontal overflow.
