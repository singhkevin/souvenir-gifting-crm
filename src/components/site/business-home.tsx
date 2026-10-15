import Link from 'next/link'
import { BrandLogoRow, BusinessOccasionBento, ProductSection } from '@/components/site/stitch-sections'
import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'
import { curateTrendingProducts } from '@/lib/catalogue/curate'
import { getPublicBrands, getPublicCategories } from '@/lib/catalogue/products'
import { getBusinessCatalogue, type BusinessProduct } from '@/lib/business/catalogue'
import { minimumOrderQty } from '@/lib/business/lines'
import { getProfile } from '@/lib/auth'
import { isBusinessRole } from '@/lib/roles'
import type { PublicProduct } from '@/lib/catalogue/products'

function businessPrice(product: PublicProduct) {
  const indicative = 'indicativePrice' in product ? (product as BusinessProduct).indicativePrice : null
  return indicative ?? product.price
}

function withImage<T extends { image_url: string | null }>(products: T[]) {
  const pictured = products.filter((product) => product.image_url)
  return pictured.length ? pictured : products
}

export async function BusinessHome({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const filters = readCatalogueFilters(searchParams)
  const profile = await getProfile()
  const companyId = profile && isBusinessRole(profile.role) ? profile.company_id : null
  const products = await getBusinessCatalogue(companyId)
  const [brands, categories] = await Promise.all([getPublicBrands(), getPublicCategories()])

  const bestsellers = withImage(curateTrendingProducts(products, 4)).slice(0, 4)
  const under999 = [...products]
    .filter((product) => {
      const price = businessPrice(product)
      return price != null && price > 0 && price < 999
    })
    .sort((a, b) => (businessPrice(a) || 0) - (businessPrice(b) || 0))
  const underRail = withImage(under999).slice(0, 4)
  const festivePool = products.filter(
    (product) =>
      product.occasion_tags.includes('festive') ||
      product.category_name === 'Hampers & Gift Sets' ||
      /festive|diwali|hamper/i.test(product.name),
  )
  const festive = withImage(festivePool).slice(0, 4)
  const caption = (product: PublicProduct) => `MOQ ${minimumOrderQty(product.moq)} · indicative`

  return (
    <div className="space-y-8 bg-[#fff8f4] py-4 text-[#221a10]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#d0c5bb] bg-white px-4 py-3">
          <p className="max-w-3xl text-sm text-[#4d453e]">
            Indicative prices follow company special price, then the catalogue price, then base price plus margin. The quotation is the final price.
          </p>
          <div className="flex gap-2">
            <Link href="/business/register" className="rounded bg-[#382c1e] px-3 py-2 text-xs font-semibold text-white">
              Register
            </Link>
            <Link href="/login?next=/business/dashboard" className="rounded border border-[#d0c5bb] px-3 py-2 text-xs font-semibold text-[#22180b]">
              Sign in
            </Link>
          </div>
        </div>
      </div>

      <BusinessOccasionBento products={products} priceOf={businessPrice} />
      <BrandLogoRow brands={brands} title="Authorised corporate co-brand partners" />

      <ProductSection
        title="High velocity corporate bestsellers"
        actionHref="/catalogue?sort=newest"
        action="View all"
        products={bestsellers}
        priceOf={businessPrice}
        showSample={false}
        captionFor={caption}
        columns="lg:grid-cols-4"
      />

      <ProductSection
        eyebrow="Seasonal"
        title="Diwali & bespoke festive hampers"
        actionHref="/collections/festival-gifting"
        action="View festive"
        products={festive}
        priceOf={businessPrice}
        showSample={false}
        captionFor={caption}
        dark
        columns="lg:grid-cols-4"
      />

      <ProductSection
        title="Budget tokens under ₹999"
        actionHref="/catalogue?priceMax=998"
        action="View all"
        products={underRail}
        priceOf={businessPrice}
        showSample={false}
        captionFor={caption}
        columns="lg:grid-cols-4"
      />

      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath="/business"
        heading="Comprehensive corporate catalogue"
        intro="Filter by category, brand, price and occasion. Prices shown here are indicative."
        priceOf={businessPrice}
        showSample={false}
        captionFor={caption}
        limit={8}
      />

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-[#d0c5bb] bg-[#fff1e5] p-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Indicative, then a quote', body: 'Special price, catalogue price, then base price plus margin.' },
            { title: 'One sample from stock', body: 'Buy a single sample on the store. Larger runs are quoted.' },
            { title: 'Branding on request', body: 'Mockups and personalisation sit with the quotation.' },
            { title: 'Fulfilment in one place', body: 'Orders, couriers and invoices stay on the same account.' },
          ].map((item) => (
            <div key={item.title}>
              <p className="font-serif text-lg text-[#22180b]">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-[#4d453e]">{item.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
