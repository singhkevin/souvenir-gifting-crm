import { CatalogueBrowser } from '@/components/site/catalogue-browser'
import { getBusinessCatalogue } from '@/lib/business/catalogue'
import { requireBusiness } from '@/lib/business/session'
import { formatCurrency } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessCataloguePage() {
  const { company, profile } = await requireBusiness()
  const products = await getBusinessCatalogue(company?.id || profile.company_id)
  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business catalogue</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Catalogue</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Prices are indicative. The final price is the quotation we send.</p>
      </div>
      <div className="border border-[#CCC5BD] bg-[#F6F3EC] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A4640]">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9E4300]" />
          <span>Add products to your quote basket to request a quotation</span>
        </div>
        <span className="sv2-label text-[10px] text-[#7C766F]">Final price is in your quotation</span>
      </div>
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
