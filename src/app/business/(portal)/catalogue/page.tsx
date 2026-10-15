import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { StoreTitle } from '@/components/site/store-ui'
import { getBusinessCatalogue } from '@/lib/business/catalogue'
import { requireBusiness } from '@/lib/business/session'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessCataloguePage() {
  const { company, profile } = await requireBusiness()
  const products = await getBusinessCatalogue(company?.id || profile.company_id)
  return (
    <div className="space-y-6">
      <StoreTitle eyebrow="Business" title="Catalogue" lede="Prices are indicative. The final price is the quotation we send." />
      <CatalogueBrowser
        products={products}
        hideQuickAdd
        hrefFor={(product) => `/business/catalogue/${product.id}`}
        priceLabel={(product) => {
          const price = 'indicativePrice' in product ? product.indicativePrice : null
          return price == null ? 'Price on quote' : formatCurrency(Number(price))
        }}
        captionFor={(product) => {
          const moq = 'moqUnits' in product ? product.moqUnits : product.moq || 1
          return `MOQ ${moq} · final price in your quote`
        }}
      />
    </div>
  )
}
