import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToQuote } from '@/components/business/add-to-quote'
import { ProductImage } from '@/components/ui/product-image'
import { getBusinessProduct, readBusinessPriceAccess } from '@/lib/business/catalogue'
import { businessPriceNotice } from '@/lib/business/price-access'
import { readBusinessSession } from '@/lib/business/session'
import { formatCurrency, isUuid } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const session = await readBusinessSession()
  const companyId = session?.company?.id || session?.profile.company_id || null
  const product = await getBusinessProduct(companyId, id)
  const priceNotice = businessPriceNotice(await readBusinessPriceAccess(session?.profile ?? null))
  if (!product) notFound()
  const showPrice = product.indicativePrice != null

  return (
    <div className="grid gap-8 lg:grid-cols-2 items-start">
      <div className="aspect-square overflow-hidden border border-[#CCC5BD] bg-[#F1EEE7] rounded-none">
        <ProductImage src={product.image_url} alt={product.name} size="hero" fit="contain" className="h-full w-full bg-transparent" />
      </div>
      <div className="space-y-4">
        <div>
          <Link href="/business/catalogue" className="inline-flex items-center gap-1.5 sv2-label text-[10px] text-[#7C766F] hover:text-[#9E4300] transition-colors">
            ← Back to catalogue
          </Link>
          <h1 className="mt-2 sv2-headline-md text-[#1C1C18]">{product.name}</h1>
          <p className="mt-1 sv2-mono-sm text-xs text-[#7C766F]">SKU: {product.sku}</p>
        </div>

        <div className="border-y border-[#CCC5BD] py-3.5 space-y-1.5">
          <div className="flex items-baseline gap-3">
            <span className="sv2-mono-lg text-2xl font-bold text-[#1C1C18]">
              {showPrice
                ? `${formatCurrency(product.indicativePrice)}${product.priceNote ? ` ${product.priceNote}` : ''}`
                : (priceNotice || 'Price on quote')}
            </span>
            <span className="sv2-label text-[10px] text-[#7C766F]">Indicative unit price</span>
          </div>
          <p className="sv2-mono-sm text-xs text-[#4A4640]">
            MOQ: {product.moqUnits} units · Final price confirmed in your quotation
          </p>
        </div>

        {product.description ? (
          <p className="text-sm leading-relaxed text-[#4A4640]">{product.description}</p>
        ) : null}

        <AddToQuote
          product={{
            id: product.id,
            sku: product.sku,
            name: product.name,
            image_url: product.image_url,
            indicativePrice: showPrice ? product.indicativePrice : null,
            moqUnits: product.moqUnits,
            buyOnStore: product.purchase.buy,
          }}
        />
      </div>
    </div>
  )
}
