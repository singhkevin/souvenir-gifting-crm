import Link from 'next/link'
import { headers } from 'next/headers'
import { getProfile } from '@/lib/auth'
import { sessionHintFromHeaders } from '@/lib/auth/session-cookie'
import { isBusinessRole, isClientRole, isGiftEmployeeRole } from '@/lib/roles'
import { landingPathForRole } from '@/lib/safe-next'
import { getBusinessCatalogue, readBusinessPriceAccess, type BusinessProduct } from '@/lib/business/catalogue'
import { businessPriceNotice } from '@/lib/business/price-access'
import { minimumOrderQty } from '@/lib/business/lines'
import { getPublicBrands, getPublicCategories, type PublicProduct } from '@/lib/catalogue/products'
import { curateTrendingProducts } from '@/lib/catalogue/curate'
import { STORE_NAV_CATEGORIES, businessNavCategoryHref } from '@/lib/catalogue/store-nav'
import { BUSINESS_CATALOGUE_PATH, BUSINESS_QUOTE_PATH } from '@/lib/business/portal-paths'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { getPublicContactPhone } from '@/lib/contact/public-phone-server'
import { siteContent } from '@/config/siteContent'

import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { UtilityBar } from '@/components/sv2/utility-bar'
import { SV2Header } from '@/components/sv2/header'
import { SV2Footer } from '@/components/sv2/footer'
import { SectionHeader } from '@/components/sv2/section-header'
import { Eyebrow } from '@/components/sv2/eyebrow'
import { SV2KitCard } from '@/components/sv2/kit-card'
import { BestsellerRail, type BestsellerProduct } from '@/components/sv2/bestseller-rail'
import { PlaceholderTile } from '@/components/sv2/placeholder-tile'
import { SV2RfpForm } from '@/components/sv2/rfp-form'
import { FeaturedKitSlider, type FeaturedKitItem } from '@/components/sv2/featured-kit-slider'
import { FadeIn } from '@/components/sv2/fade-in'
import { SV2Button } from '@/components/sv2/button'

function businessPrice(product: PublicProduct): number | null {
  if ('indicativePrice' in product) return (product as BusinessProduct).indicativePrice
  return product.price
}

function withImage<T extends { image_url: string | null }>(items: T[]): T[] {
  const pictured = items.filter((item) => item.image_url)
  return pictured.length ? pictured : items
}

export async function BusinessHome({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const filters = readCatalogueFilters(searchParams)
  const headerStore = await headers()
  const profile = sessionHintFromHeaders((name) => headerStore.get(name)) ? await getProfile() : null
  const companyId = profile && isBusinessRole(profile.role) ? profile.company_id : null
  const priceAccess = await readBusinessPriceAccess(profile)
  const priceNotice = businessPriceNotice(priceAccess)
  const showPrices = priceAccess === 'open'
  const portalAccount = profile && (isClientRole(profile.role) || isGiftEmployeeRole(profile.role))
  const accountHref = profile && !portalAccount ? landingPathForRole(profile.role) : null
  const accountLabel = profile && !portalAccount
    ? isBusinessRole(profile.role)
      ? 'Business portal'
      : 'Workspace'
    : null

  const [products, categories, brands, phone] = await Promise.all([
    getBusinessCatalogue(companyId).catch(() => [] as BusinessProduct[]),
    getPublicCategories().catch(() => []),
    getPublicBrands().catch(() => []),
    getPublicContactPhone(),
  ])

  // Featured kits for hero slider come ONLY from live products
  const featuredKitsPool = products.filter(
    (p) =>
      p.image_url &&
      (/kit|hamper|set/i.test(p.name) ||
        p.category_name?.toLowerCase().includes('kit') ||
        p.category_name?.toLowerCase().includes('hamper')),
  )
  const heroKitProducts = featuredKitsPool.length > 0
    ? featuredKitsPool.slice(0, 4)
    : withImage(products).slice(0, 4)

  const heroKits: FeaturedKitItem[] = heroKitProducts.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku || null,
    badge: p.category_name || null,
    leadSla: null, // Lead time omitted because not present in data
    description: p.description || null,
    price: showPrices ? businessPrice(p) : null,
    priceText: showPrices ? null : priceNotice,
    moq: 'moqUnits' in p && typeof (p as BusinessProduct).moqUnits === 'number'
      ? (p as BusinessProduct).moqUnits
      : minimumOrderQty(p.moq),
    imageUrl: p.image_url || '/site/story-executive.webp',
  }))

  // 01 Shop by Occasion kit cards (plain, generic descriptions with no invented materials/specs)
  const occasionDefs = [
    {
      title: 'Festive & Diwali Hampers',
      tag: 'FESTIVE SEASON',
      description: 'Seasonal hampers and gift boxes for teams and clients.',
      href: '/business/catalogue?occasion=festive',
      imageUrl: '/site/home-festival-crate.webp',
      matchFilter: (p: BusinessProduct) =>
        p.occasion_tags?.includes('festive') ||
        p.category_name === 'Hampers & Gift Sets' ||
        /festive|diwali|hamper/i.test(p.name),
    },
    {
      title: 'Day-One Welcome Kits',
      tag: 'ONBOARDING',
      description: 'Welcome sets with drinkware, notebooks, and desk essentials for new joiners.',
      href: '/business/catalogue?occasion=welcome',
      imageUrl: '/site/home-welcome-kit.webp',
      matchFilter: (p: BusinessProduct) =>
        p.occasion_tags?.includes('welcome') ||
        p.category_name === 'Welcome Kits' ||
        /welcome|joining/i.test(p.name),
    },
    {
      title: 'Client & CXO Appreciation',
      tag: 'EXECUTIVE',
      description: 'Thoughtful executive gifts and premium pieces for key clients and partners.',
      href: '/business/catalogue?occasion=client',
      imageUrl: '/site/home-client-appreciation.webp',
      matchFilter: (p: BusinessProduct) =>
        p.category_name === 'Awards & Recognition' || /cxo|client|executive/i.test(p.name),
    },
    {
      title: 'Onboarding Essentials',
      tag: 'JOINING KITS',
      description: 'Practical desk and daily essentials to equip your team from day one.',
      href: '/business/catalogue?occasion=onboarding',
      imageUrl: '/site/home-new-joiner.webp',
      matchFilter: (p: BusinessProduct) =>
        p.occasion_tags?.includes('onboarding') || /onboard|joiner|essentials/i.test(p.name),
    },
    {
      title: 'Conferences & Summits',
      tag: 'EVENTS',
      description: 'Curated delegate gifts including drinkware, bags, notebooks, and tech.',
      href: '/business/catalogue?occasion=conference',
      imageUrl: '/site/story-executive.webp',
      matchFilter: (p: BusinessProduct) =>
        ['Drinkware', 'Desk & Stationery', 'Tech & Electronics'].includes(p.category_name || '') ||
        /conference|summit|event/i.test(p.name),
    },
    {
      title: 'Work Anniversary & Milestones',
      tag: 'RECOGNITION',
      description: 'Recognition gifts and commemorative keepsakes for long-standing team members.',
      href: '/business/catalogue?occasion=anniversary',
      imageUrl: '/site/banner-milestones.webp',
      matchFilter: (p: BusinessProduct) =>
        ['Apparel', 'Bags & Travel', 'Awards & Recognition', 'Watches'].includes(
          p.category_name || '',
        ) || /anniversary|honour|milestone/i.test(p.name),
    },
  ]

  // Resolve prices & MOQs for occasion kits from live products where available
  const resolvedOccasionKits = occasionDefs.map((item) => {
    const matching = products.filter(item.matchFilter)
    const validPrices = matching
      .map(businessPrice)
      .filter((p): p is number => p != null && p > 0)
    const minPrice = validPrices.length ? Math.min(...validPrices) : null
    const firstWithImage = matching.find((p) => p.image_url)
    const validMoqs = matching
      .map((p) => ('moqUnits' in p && typeof (p as BusinessProduct).moqUnits === 'number' ? (p as BusinessProduct).moqUnits : minimumOrderQty(p.moq)))
      .filter((m): m is number => m != null && m > 0)
    const minMoq = validMoqs.length ? Math.min(...validMoqs) : null

    return {
      title: item.title,
      tag: item.tag,
      description: item.description,
      customisation: 'Branding on request',
      leadTime: undefined, // Omit invented lead time
      moq: minMoq,
      href: item.href,
      imageUrl: firstWithImage?.image_url || item.imageUrl,
      price: showPrices ? minPrice : null,
    }
  })

  // 02 Corporate Bestsellers (live products only via existing data + pricing paths)
  const liveBestsellers = withImage(curateTrendingProducts(products, 5)).slice(0, 5)
  const bestsellerProducts: BestsellerProduct[] = liveBestsellers.map((item) => ({
    id: item.id,
    name: item.name,
    sku: item.sku || null,
    imageUrl: item.image_url,
    description: item.description,
    price: showPrices ? businessPrice(item) : null,
    priceText: showPrices ? null : priceNotice,
    moq: ('moqUnits' in item && typeof (item as BusinessProduct).moqUnits === 'number')
      ? (item as BusinessProduct).moqUnits
      : minimumOrderQty(item.moq),
    categoryName: item.category_name,
    occasionTags: item.occasion_tags,
  }))

  const caption = (product: PublicProduct) => `MOQ ${minimumOrderQty(product.moq)} · indicative`

  const navCategories = STORE_NAV_CATEGORIES.map((item) => ({
    href: businessNavCategoryHref(categories, item.name),
    label: item.label,
    icon: item.icon,
  }))

  return (
    <div className="w-full max-w-full min-w-0 pb-16 md:pb-0">
      {/* 1. Utility Bar */}
      <UtilityBar phone={phone} showMinimumOrder />

      {/* Primary Header */}
      <SV2Header categories={navCategories} accountHref={accountHref} accountLabel={accountLabel} />

      <main id="main-content" className="w-full max-w-full min-w-0">
        {/* Indicative pricing notice & account access bar */}
        <aside
          className="border-b border-[#7C766F] bg-[#1C1B1A] px-4 sm:px-8 lg:px-16 py-2.5"
          aria-label={priceNotice ? 'Business pricing' : 'Indicative pricing notice'}
        >
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
            <p className="text-[#cac6c4] sv2-body-sm">
              {priceNotice ? (
                priceNotice
              ) : (
                <>
                  <span className="text-[#FFB690] font-semibold">Note:</span> Prices shown are indicative. Your quotation is the final price.
                </>
              )}
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/business/register"
                className="text-[#FCF9F2] hover:text-[#FF8843] transition-colors sv2-label text-[11px]"
              >
                Register
              </Link>
              <span className="text-[#7C766F]" aria-hidden="true">|</span>
              <Link
                href="/login?next=/business/dashboard"
                className="text-[#FFB690] hover:text-[#FCF9F2] transition-colors sv2-label text-[11px]"
              >
                Sign in
              </Link>
            </div>
          </div>
        </aside>

        {/* 2. Hero Section: Contemporary Indian Bold Editorial */}
        <section
          className="bg-[#1C1B1A] text-[#FCF9F2] border-b border-[#7C766F] w-full max-w-full min-w-0 overflow-hidden"
          aria-label="Corporate Gifting Overview"
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            {/* Left Column: Narrative & Quick SLAs */}
            <div className="lg:col-span-7 flex flex-col justify-between pr-0 lg:pr-8">
              <div>
                <div className="inline-flex max-w-full items-center gap-2 border border-[#7C766F] px-2.5 sm:px-3 py-1 sv2-label text-[#FFB690] mb-6 text-[10px] sm:text-[11px]">
                  <span className="truncate">Corporate &amp; festive gifts — {siteContent.utilityBar.gstNote}</span>
                </div>

                <h1 className="sv2-display text-[#FCF9F2] mb-6">
                  Corporate gifts your team and clients will{' '}
                  <span className="italic font-normal text-[#FFB690]">actually keep</span>.
                </h1>

                <p className="sv2-body-lg text-[#cac6c4] max-w-xl mb-8">
                  Custom gift sets, festive hampers, and day-one onboarding kits —
                  curated for corporate gifting with single-source GST invoicing.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 mb-10">
                  <SV2Button variant="saffron" href={BUSINESS_QUOTE_PATH}>
                    Quote basket
                  </SV2Button>
                  <SV2Button variant="outline-light" href="#catalog">
                    Explore Catalogue
                  </SV2Button>
                </div>
              </div>

              {/* Quick SLA Indicators from siteContent placeholders */}
              <div className="grid grid-cols-3 border-t border-[#7C766F] pt-4 gap-2 sm:gap-4 min-w-0">
                <div className="min-w-0">
                  <span className="block sv2-mono-sm text-[#FFB690] font-bold">
                    {siteContent.stats.dispatch}
                  </span>
                  <span className="text-[#868382] sv2-body-sm text-xs">Sample Dispatch</span>
                </div>
                <div className="border-l border-[#7C766F] pl-2 sm:pl-4 min-w-0">
                  <span className="block sv2-mono-sm text-[#FFB690] font-bold">
                    {siteContent.stats.pinCodes}
                  </span>
                  <span className="text-[#868382] sv2-body-sm text-xs">PIN Codes Served</span>
                </div>
                <div className="border-l border-[#7C766F] pl-2 sm:pl-4 min-w-0">
                  <span className="block sv2-mono-sm text-[#FFB690] font-bold">
                    {siteContent.stats.breakageCover}
                  </span>
                  <span className="text-[#868382] sv2-body-sm text-xs">Breakage Guarantee</span>
                </div>
              </div>
            </div>

            {/* Right Column: Featured Kit Slider (or PlaceholderTile if no live products) */}
            <div className="lg:col-span-5">
              {heroKits.length > 0 ? (
                <FeaturedKitSlider items={heroKits} />
              ) : (
                <div className="border border-[#7C766F] bg-[#1C1B1A]/80 p-8 flex items-center justify-center min-h-[380px]">
                  <PlaceholderTile text="[Featured kit]" className="w-full h-64" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Quick Spec Discovery Strip */}
        <section
          className="w-full max-w-full min-w-0 bg-[#F6F3EC] border-b border-[#CCC5BD] py-3 sm:py-4 px-4 sm:px-8 lg:px-16 overflow-hidden"
          aria-label="Quick Spec Discovery"
        >
          <div className="max-w-[1440px] mx-auto w-full max-w-full min-w-0">
            <div className="w-full max-w-full min-w-0 overflow-x-auto flex items-center gap-3 sm:gap-4 text-[#1C1C18] py-0.5 no-scrollbar">
              <span className="sv2-label text-[#7C766F] uppercase tracking-wider whitespace-nowrap shrink-0">
                QUICK DISCOVERY
              </span>
              <div className="flex items-center gap-3 min-w-max">
                <Link
                  href="/business/catalogue?q=welcome%20kit"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Welcome Kits</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Kits</span>
                </Link>
                <Link
                  href="/business/catalogue?q=drinkware"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Thermal Drinkware</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Insulated</span>
                </Link>
                <Link
                  href="/business/catalogue?q=notebook"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Desk &amp; Stationery</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Desk Sets</span>
                </Link>
                <Link
                  href="/business/catalogue?q=copper"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Copper &amp; Brass</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Handcrafted</span>
                </Link>
                <Link
                  href="/business/catalogue?q=tech"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Tech &amp; Electronics</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Accessories</span>
                </Link>
                <Link
                  href="/business/catalogue?occasion=festive"
                  className="flex items-center gap-2 border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-1.5 hover:border-[#000000] transition-colors shrink-0"
                >
                  <span className="sv2-label text-[11px] text-[#1C1C18]">Festive Hampers</span>
                  <span className="sv2-body-sm text-xs text-[#7C766F]">Curated</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Section 01: Shop by Occasion & Milestone */}
        <FadeIn as="section" className="py-12 lg:py-20 px-4 sm:px-8 lg:px-16 max-w-[1440px] mx-auto w-full max-w-full min-w-0">
          <div id="occasions">
            <SectionHeader
              numeral="01"
              title={
                <>
                  Procure by <span className="italic font-normal">Occasion &amp; Milestone</span>
                </>
              }
              subtitle="Curated corporate gifting sets configured for rapid team and client delivery."
              actionHref={BUSINESS_CATALOGUE_PATH}
              actionLabel="View full catalogue →"
            />

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 lg:gap-8">
              {resolvedOccasionKits.map((kit) => (
                <SV2KitCard
                  key={kit.title}
                  title={kit.title}
                  tag={kit.tag}
                  description={kit.description}
                  imageUrl={kit.imageUrl}
                  price={kit.price}
                  priceText={showPrices ? null : priceNotice}
                  moq={kit.moq}
                  href={kit.href}
                  customisation={kit.customisation}
                  leadTime={kit.leadTime}
                />
              ))}
            </div>
          </div>
        </FadeIn>

        {/* 5. Section 02: Corporate Bestsellers (Live products or PlaceholderTiles) */}
        <FadeIn as="section" className="bg-[#F6F3EC] border-y border-[#CCC5BD] py-12 lg:py-20 w-full max-w-full min-w-0">
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16 w-full max-w-full min-w-0">
            <SectionHeader
              numeral="02"
              title="Corporate Bestsellers"
              subtitle="Popular corporate gifts ready for delivery across India."
              actionHref={BUSINESS_CATALOGUE_PATH}
              actionLabel="Explore all items →"
            />

            {bestsellerProducts.length > 0 ? (
              <BestsellerRail products={bestsellerProducts} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <PlaceholderTile key={idx} text="[Product]" className="h-64" />
                ))}
              </div>
            )}
          </div>
        </FadeIn>

        {/* 6. Section 03: Comprehensive Corporate Catalogue */}
        <FadeIn as="section" className="py-12 lg:py-20 px-4 sm:px-8 lg:px-16 max-w-[1440px] mx-auto border-b border-[#CCC5BD] w-full max-w-full min-w-0">
          <SectionHeader
            numeral="03"
            title="Comprehensive Corporate Catalogue"
            subtitle={showPrices ? 'Filter by category, brand, price and occasion. Prices shown here are indicative.' : priceNotice || undefined}
            actionHref={BUSINESS_CATALOGUE_PATH}
            actionLabel="View all catalogue products →"
          />

          <StorefrontCatalog
            products={products}
            categories={categories}
            brands={brands}
            filters={filters}
            basePath="/business"
            heading="Corporate gift catalogue"
            priceOf={(product) => (showPrices ? businessPrice(product) : null)}
            showSample={false}
            captionFor={showPrices ? caption : undefined}
            hiddenPriceLabel={priceNotice}
            limit={8}
            channel="business"
            embedded
          />
        </FadeIn>

        {/* 7. Section 04: Proof + Brand Partners */}
        <FadeIn as="section" className="py-12 lg:py-20 px-4 sm:px-8 lg:px-16 max-w-[1440px] mx-auto w-full max-w-full min-w-0">
          <div>
            <SectionHeader
              numeral="04"
              title="Client Deliveries &amp; Brand Partners"
              subtitle="Verified client projects, case studies, and authorised brand partners."
            />

            {/* Client Logo Tiles (Neutral Placeholders) */}
            <div className="mb-10">
              <Eyebrow className="mb-3">Client deliveries</Eyebrow>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {siteContent.clientLogos.map((logo, idx) => (
                  <PlaceholderTile key={idx} text={logo} className="h-20" />
                ))}
              </div>
            </div>

            {/* Case Study Card (Neutral Placeholder) */}
            <div className="mb-10">
              <Eyebrow className="mb-3">Case study</Eyebrow>
              {siteContent.caseStudies.map((cs, idx) => (
                <article
                  key={idx}
                  className="border border-[#CCC5BD] bg-[#F6F3EC] p-6 sm:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6"
                >
                  <div className="space-y-2 max-w-2xl">
                    <Eyebrow tone="saffron">Case study — multi-city logistics</Eyebrow>
                    <h3 className="sv2-headline-sm text-[#1C1C18]">{cs.title}</h3>
                    <p className="sv2-body-sm text-[#4A4640]">{cs.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="border border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3 text-center">
                      <span className="sv2-body-sm text-xs text-[#7C766F] block">Volume</span>
                      <span className="sv2-mono-lg text-[#1C1B1A] font-bold">{cs.stat}</span>
                    </div>
                    <div className="border border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3 text-center">
                      <span className="sv2-body-sm text-xs text-[#7C766F] block">Hub</span>
                      <span className="sv2-mono-lg text-[#1C1B1A] font-bold">{cs.location}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Brand Partners */}
            <div className="border-y border-[#1C1B1A] bg-[#F6F3EC] p-6 sm:p-8">
              <span aria-hidden="true" className="mb-3 block h-0.5 w-10 bg-[#9E4300]" />
              <Eyebrow className="mb-1">Brands we work with</Eyebrow>
              <h3 className="mb-2 font-serif text-2xl font-normal text-[#1C1C18]">Brand partners</h3>
              <p className="mb-6 sv2-body-sm text-[#4A4640]">Branded products available through our catalogue.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {siteContent.partnerBrands.map((brand, idx) => (
                  <PlaceholderTile key={idx} text={brand} className="h-20" />
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* 8. Section 05: Why Souvenir + Quotation Form */}
        <section
          id="quote-desk"
          className="bg-[#1C1B1A] text-[#FCF9F2] py-12 lg:py-20 border-b border-[#7C766F] w-full max-w-full min-w-0 overflow-hidden"
          aria-label="Request a quotation"
        >
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 lg:px-16 w-full max-w-full min-w-0">
            <SectionHeader
              numeral="05"
              title={
                <>
                  Built for Corporate Teams{' '}
                  <span className="italic font-normal text-[#FFB690]">&amp; Clients</span>.
                </>
              }
              subtitle={showPrices ? 'Clear indicative pricing, single-unit samples, and complete GST invoicing.' : priceNotice || undefined}
              dark
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Left: 4 Capability Pillars from old page */}
              <div className="lg:col-span-6 space-y-4">
                {siteContent.whySouvenir.map((point, idx) => (
                  <div
                    key={idx}
                    className="border border-[#7C766F] bg-[#1C1B1A]/80 p-5 sm:p-6"
                  >
                    <div className="flex items-start gap-4">
                      <span className="sv2-mono-sm text-[#FFB690] border border-[#9E4300] px-2 py-0.5 shrink-0 font-bold">
                        0{idx + 1}
                      </span>
                      <div>
                        <h3 className="sv2-headline-sm text-[#FCF9F2] mb-1.5 font-normal">
                          {point.title}
                        </h3>
                        <p className="sv2-body-sm text-[#cac6c4] leading-relaxed">
                          {point.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lg:col-span-6 space-y-4">
                <p className="sv2-body-sm text-[#cac6c4]">
                  <Link href={BUSINESS_QUOTE_PATH} className="text-[#FFB690] hover:underline">
                    Add gifts to the quote basket
                  </Link>{' '}
                  and submit them as one request. A business account is required to send it.
                </p>
                <SV2RfpForm phone={phone} />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. Footer */}
      <SV2Footer phone={phone} />

      {/* 10. Mobile Sticky CTA Bar */}
      <aside
        className="fixed bottom-0 left-0 right-0 w-full z-40 md:hidden bg-[#1C1B1A] border-t border-[#7C766F] px-4 py-3 flex items-center justify-between"
        aria-label="Mobile quick action"
      >
        <div>
          <span className="sv2-label text-[#FFB690] block text-[10px] font-bold">
            CORPORATE QUOTE
          </span>
          <span className="sv2-mono-sm text-[#FCF9F2] text-xs font-semibold">
            {siteContent.stats.quoteTurnaround}
          </span>
        </div>
        <Link
          href={BUSINESS_QUOTE_PATH}
          className="bg-[#9E4300] hover:bg-[#FF8843] text-white px-4 py-2 sv2-label text-xs tracking-wider transition-colors uppercase font-bold"
        >
          Quote basket
        </Link>
      </aside>
    </div>
  )
}
