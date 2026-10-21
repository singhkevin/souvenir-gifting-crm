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
