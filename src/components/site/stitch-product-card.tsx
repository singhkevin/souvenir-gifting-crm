import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { RetailBuyActions } from '@/components/site/retail-buy'
import { retailStatusLabel } from '@/lib/catalogue/storefront'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

export function StitchProductCard({
  product,
  href,
  price,
  showSample = true,
  caption,
  tone = 'default',
}: {
  product: PublicProduct
  href?: string
  price?: number | null
  showSample?: boolean
  caption?: string
  tone?: 'default' | 'retail'
}) {
  const destination = href || `/catalogue/${product.id}`
  const amount = price === undefined ? product.price : price
  const quoteHref = `/request-quote?product=${product.id}`
  const meta = [product.category_name, product.brand_name].filter(Boolean).join(' · ')
  const retail = tone === 'retail'

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#eadfd4] bg-white shadow-[0_8px_24px_rgba(34,24,11,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7c4a4] hover:shadow-[0_16px_36px_rgba(34,24,11,0.08)]">
      <Link href={destination} className="block p-2.5 text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735c00]">
        <div className="relative aspect-square overflow-hidden rounded-lg bg-[#f6efe6]">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent"
          />
        </div>
        {meta ? (
          <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wider text-[#715a3e]">{meta}</p>
        ) : null}
        <h3 className="mt-0.5 line-clamp-2 min-h-10 font-sans text-[15px] leading-5 font-semibold text-[#22180b]">{product.name}</h3>
        <p className="mt-2 text-base font-bold tracking-tight text-[#22180b]">
          {amount == null ? (retail ? '—' : 'Price on quote') : formatCurrency(amount)}
        </p>
        <p className="text-[11px] font-semibold text-[#715a3e]">
          {caption || (retail ? retailStatusLabel(product.purchase) : product.moq ? `MOQ ${product.moq}` : 'Request a quote')}
        </p>
      </Link>
      {retail ? (
        <div className="mt-auto px-2.5 pt-2 pb-2.5">
          <RetailBuyActions
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              price: amount,
              image_url: product.image_url,
              purchase: product.purchase,
            }}
          />
        </div>
      ) : (
        <div className="mt-auto grid grid-cols-2 gap-1.5 px-2.5 pt-2 pb-2.5">
          {showSample && product.purchase.buy ? (
            <AddToCartButton
              maxQuantity={product.purchase.maxBuyQty}
              label="Add to cart"
              product={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: amount,
                image_url: product.image_url,
              }}
              className="rounded-md border border-[#eadfd4] bg-[#fbf6f0] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#f6efe6]"
            />
          ) : (
            <Link
              href={quoteHref}
              className="rounded-md border border-[#eadfd4] bg-[#fbf6f0] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#f6efe6]"
            >
              Request quote
            </Link>
          )}
          <Link
            href={showSample && product.purchase.buy ? quoteHref : destination}
            className="rounded-md bg-[#22180b] px-2 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#382c1e]"
          >
            {showSample && product.purchase.buy ? 'Request quote' : 'View'}
          </Link>
        </div>
      )}
    </article>
  )
}
