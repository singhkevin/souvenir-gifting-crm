import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddToQuote } from '@/components/business/add-to-quote'
import { ProductImage } from '@/components/ui/product-image'
import { getBusinessProduct } from '@/lib/business/catalogue'
import { requireBusiness } from '@/lib/business/session'
import { formatCurrency, isUuid } from '@/lib/utils'
import { StoreTitle } from '@/components/site/store-ui'

export const dynamic = 'force-dynamic'

export default async function BusinessProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { company, profile } = await requireBusiness()
  const product = await getBusinessProduct(company?.id || profile.company_id, id)
  if (!product) notFound()

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="aspect-square overflow-hidden rounded-xl border border-[#eadfd4] bg-[#f6efe6]">
        <ProductImage src={product.image_url} alt={product.name} size="hero" fit="contain" className="h-full w-full bg-transparent" />
      </div>
      <div className="space-y-4">
        <Link href="/business/catalogue" className="store-eyebrow">Catalogue</Link>
        <StoreTitle title={product.name} />
        <p className="font-mono text-xs text-[#4d453e]">{product.sku}</p>
        <p className="text-lg font-semibold text-[#22180b]">
          {product.indicativePrice == null ? 'Price on quote' : formatCurrency(product.indicativePrice)}
        </p>
        <p className="text-xs uppercase tracking-[0.12em] text-[#5C6570]">Indicative · MOQ {product.moqUnits} · final price in your quote</p>
        {product.description ? <p className="text-sm leading-6 text-[#5C6570]">{product.description}</p> : null}
        <AddToQuote
          product={{
            id: product.id,
            sku: product.sku,
            name: product.name,
            image_url: product.image_url,
            indicativePrice: product.indicativePrice,
            moqUnits: product.moqUnits,
            buyOnStore: product.purchase.buy,
          }}
        />
      </div>
    </div>
  )
}
