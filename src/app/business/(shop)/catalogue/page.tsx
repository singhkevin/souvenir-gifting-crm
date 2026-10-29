import { StorefrontCatalog } from '@/components/site/storefront-catalog'
import { getBusinessCatalogue, readBusinessPriceAccess, type BusinessProduct } from '@/lib/business/catalogue'
import { businessPriceNotice } from '@/lib/business/price-access'
import { readBusinessSession } from '@/lib/business/session'
import { minimumOrderQty } from '@/lib/business/lines'
import { getPublicBrands, getPublicCategories, type PublicProduct } from '@/lib/catalogue/products'
import { readCatalogueFilters } from '@/lib/catalogue/catalogue-query'

export const dynamic = 'force-dynamic'

function businessPrice(product: PublicProduct): number | null {
  if ('indicativePrice' in product) return (product as BusinessProduct).indicativePrice
  return product.price
}

export default async function BusinessCataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const filters = readCatalogueFilters(await searchParams)
  const session = await readBusinessSession()
  const companyId = session?.company?.id || session?.profile.company_id || null
  const [products, categories, brands, priceAccess] = await Promise.all([
    getBusinessCatalogue(companyId),
    getPublicCategories().catch(() => []),
    getPublicBrands().catch(() => []),
    readBusinessPriceAccess(session?.profile ?? null),
  ])
  const priceNotice = businessPriceNotice(priceAccess)
  const showPrices = priceAccess === 'open'

  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business catalogue</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Catalogue</h1>
        <p className="mt-1 text-sm text-[#4A4640]">
          {priceNotice || 'Prices are indicative. The final price is the quotation we send.'}
        </p>
      </div>
      <StorefrontCatalog
        products={products}
        categories={categories}
        brands={brands}
        filters={filters}
        basePath="/business/catalogue"
        heading="Corporate gift catalogue"
        priceOf={(product) => (showPrices ? businessPrice(product) : null)}
        showSample={false}
        captionFor={(product) => `MOQ ${minimumOrderQty(product.moq)} · indicative`}
        hiddenPriceLabel={priceNotice}
        channel="business"
        embedded
      />
    </div>
  )
}
