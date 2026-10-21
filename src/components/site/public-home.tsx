import Link from 'next/link'
import { siteContent } from '@/config/siteContent'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { RetailHero } from '@/components/site/retail-hero'
import { BrandLogoRow, ProductSection, RetailOccasionBento } from '@/components/site/stitch-sections'
import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { curateTrendingProducts, retailHeroSlides } from '@/lib/catalogue/curate'
import { getPublicBrands, getPublicCatalogueProducts, getPublicCategories } from '@/lib/catalogue/products'
import type { PublicProduct } from '@/lib/catalogue/products'

function storePrice(product: PublicProduct) {
  return product.price
}

function withImage(products: PublicProduct[]) {
  const pictured = products.filter((product) => product.image_url)
  return pictured.length ? pictured : products
}

export async function PublicHome({
  searchParams,
  basePath = '/home',
}: {
  searchParams?: Record<string, string | string[] | undefined>
  basePath?: string
}) {
  const filters = readCatalogueFilters(searchParams)
  const loaded = await getPublicCatalogueProducts()
  const preview = process.env.STOREFRONT_UI_PREVIEW === '1' && loaded.length === 0
  const products = loaded
  const loadedBrands = await getPublicBrands()
  const brands = preview
    ? [
        { id: '11111111-1111-4111-8111-111111111111', name: 'Souvenir', logo_url: '/logo.png' },
        { id: '22222222-2222-4222-8222-222222222222', name: 'Field', logo_url: null },
      ]
    : loadedBrands
  const categories = await getPublicCategories()

  const heroSlides = retailHeroSlides(products).map((slide) =>
    slide.map((product) => ({ id: product.id, name: product.name, image_url: product.image_url })),
  )
  const bestsellers = withImage(curateTrendingProducts(products, 5)).slice(0, 5)
  const under999 = [...products]
    .filter((product) => product.price != null && product.price > 0 && product.price < 999)
    .sort((a, b) => (a.price || 0) - (b.price || 0))
  const underRail = withImage(under999).slice(0, 6)
  const festivePool = products.filter(
    (product) =>
      product.occasion_tags.includes('festive') ||
      product.category_name === 'Hampers & Gift Sets' ||
      /festive|diwali|hamper/i.test(product.name),
  )
  const festive = withImage(festivePool).slice(0, 4)

  return (
    <div className="bg-[#FCF9F2] text-[#1C1C18]">
      {/* 1. Charcoal Hero Band */}
      <RetailHero slides={heroSlides} />

      {/* 2. Procure by Occasion & Milestone Grid */}
      <RetailOccasionBento products={products} priceOf={storePrice} />

      {/* 3. Retail Bestsellers */}
      <ProductSection
        eyebrow="Most Requested"
        title="Retail Bestsellers — Ready to Ship"
        actionHref="/catalogue?sort=newest"
        action="View All"
        products={bestsellers}
        priceOf={storePrice}
        columns="lg:grid-cols-5"
        tone="retail"
      />

      {/* 4. Brand Alliances */}
      <BrandLogoRow brands={brands} eyebrow="Partner Alliances" title="Authorised Brand Alliances" tone="retail" />

      {/* 5. Merchandise Under ₹999 */}
      <ProductSection
        eyebrow="Everyday"
        title="Merchandise under ₹999"
        actionHref="/catalogue?priceMax=998"
        action="View All"
        products={underRail}
        priceOf={storePrice}
        columns="lg:grid-cols-6"
        tone="retail"
      />

      {/* 6. Seasonal Hampers (Dark Charcoal Band) */}
      <ProductSection
        eyebrow="Seasonal Editions"
        title="Festive Gift Hampers"
        actionHref="/collections/festival-gifting"
        action="View All"
        products={festive}
        priceOf={storePrice}
        dark
        columns="lg:grid-cols-4"
        tone="retail"
      />

      {/* 7. Unboxing Experience Strip */}
      <section className="border-b border-[#CCC5BD] bg-[#F6F3EC] py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 border-b border-[#CCC5BD] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <span className="font-sans text-xs uppercase tracking-wider font-semibold text-[#9E4300] block mb-1">Packaging &amp; delivery</span>
              <h2 className="font-serif sv2-headline-md font-normal text-[#1C1C18]">
                Every Gift, an Unforgettable <span className="italic text-[#9E4300]">Unboxing Experience</span>.
              </h2>
            </div>
            <span className="font-sans text-xs uppercase tracking-wider font-semibold text-[#7C766F]">Packaging &amp; Delivery</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-2">
              <span className="border border-[#9E4300] px-2 py-0.5 font-sans text-xs text-[#9E4300] font-semibold">01</span>
              <h4 className="font-serif text-lg text-[#1C1C18] font-normal pt-2">Gift packaging</h4>
              <p className="sv2-body-sm text-[#4A4640]">
                {siteContent.retail.packagingNote}
              </p>
            </div>
            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-2">
              <span className="border border-[#9E4300] px-2 py-0.5 font-sans text-xs text-[#9E4300] font-semibold">02</span>
              <h4 className="font-serif text-lg text-[#1C1C18] font-normal pt-2">Direct-to-recipient dispatch</h4>
              <p className="sv2-body-sm text-[#4A4640]">
                {siteContent.retail.directDispatchNote}
              </p>
            </div>
            <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-2">
              <span className="border border-[#9E4300] px-2 py-0.5 font-sans text-xs text-[#9E4300] font-semibold">03</span>
              <h4 className="font-serif text-lg text-[#1C1C18] font-normal pt-2">Delivery</h4>
              <p className="sv2-body-sm text-[#4A4640]">
                {siteContent.retail.dispatchCities}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Filterable Live Catalogue */}
      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath={basePath}
        heading="Live Procurement Catalogue"
        intro="Filter the live catalogue by category, brand, price and occasion."
        priceOf={storePrice}
        limit={8}
        tone="retail"
      />

      {preview ? (
        <section className="bg-[#FCF9F2] py-8 border-t border-[#CCC5BD]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
            <p className="sv2-body-sm text-[#4A4640]">In stock</p>
            <AddToCartButton
              maxQuantity={1}
              label="Buy 1 sample"
              product={{ id: '33333333-3333-4333-8333-333333333333', sku: 'BTL-1', name: 'Steel bottle', price: 450, image_url: '/site/home-festive-cane.webp' }}
              className="inline-flex bg-[#000000] px-5 py-2.5 sv2-label text-white uppercase tracking-wider"
            />
            <Link href="/request-quote" className="inline-flex border border-[#CCC5BD] px-5 py-2.5 sv2-label text-[#1C1C18] uppercase tracking-wider hover:border-[#000000]">
              Request a Quote
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  )
}
