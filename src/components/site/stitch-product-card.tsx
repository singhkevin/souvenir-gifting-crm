import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
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
    <article
      className={
        retail
          ? 'group flex h-full flex-col overflow-hidden rounded-xl border border-[#eadfd4] bg-white shadow-[0_8px_24px_rgba(34,24,11,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7c4a4] hover:shadow-[0_16px_36px_rgba(34,24,11,0.08)]'
          : 'flex h-full flex-col rounded border border-[#d0c5bb] bg-white p-3 transition-shadow hover:border-[#715a3e] hover:shadow-md'
      }
    >
      <Link href={destination} className={`block text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#735c00] ${retail ? 'p-2.5' : ''}`}>
        <div className={retail ? 'relative aspect-square overflow-hidden rounded-lg bg-[#f6efe6]' : 'relative aspect-square overflow-hidden rounded bg-[#fcebdb]'}>
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent"
          />
          {product.purchase.buy && showSample ? (
            <span className="absolute left-2 top-2 rounded border border-[#d0c5bb] bg-[#fff1e5] px-1.5 py-0.5 text-[10px] font-bold text-[#22180b]">
              Sample available
            </span>
          ) : null}
        </div>
        {meta ? (
          <p className="mt-2 truncate text-[10px] font-bold uppercase tracking-wider text-[#715a3e]">{meta}</p>
        ) : null}
        <h3 className={`mt-0.5 line-clamp-2 font-sans font-semibold text-[#22180b] ${retail ? 'min-h-10 text-[15px] leading-5' : 'text-sm leading-5'}`}>{product.name}</h3>
        <p className={`font-bold tracking-tight text-[#22180b] ${retail ? 'mt-2 text-base' : 'mt-2 text-lg'}`}>
          {amount == null ? 'Request quotation' : formatCurrency(amount)}
        </p>
        <p className="text-[11px] font-semibold text-[#715a3e]">
          {caption || (product.moq ? `MOQ ${product.moq}` : showSample ? 'One sample, or request a quote' : 'Request a quote')}
        </p>
      </Link>
      <div className={retail ? 'mt-auto grid grid-cols-2 gap-1.5 px-2.5 pt-2 pb-2.5' : 'mt-3 grid grid-cols-2 gap-1.5 border-t border-[#d0c5bb]/70 pt-2'}>
        {showSample && product.purchase.buy ? (
          <AddToCartButton
            maxQuantity={product.purchase.maxBuyQty}
            label="Buy 1 sample"
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              price: amount,
              image_url: product.image_url,
            }}
            className={retail ? 'rounded-md border border-[#eadfd4] bg-[#fbf6f0] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#f6efe6]' : 'rounded border border-[#d0c5bb] bg-[#fcebdb] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#fdddb9]'}
          />
        ) : (
          <Link
            href={quoteHref}
            className={retail ? 'rounded-md border border-[#eadfd4] bg-[#fbf6f0] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#f6efe6]' : 'rounded border border-[#d0c5bb] bg-[#fcebdb] px-2 py-1.5 text-center text-[11px] font-semibold text-[#22180b] hover:bg-[#fdddb9]'}
          >
            Request quote
          </Link>
        )}
        <Link
          href={showSample && product.purchase.buy ? quoteHref : destination}
          className={retail ? 'rounded-md bg-[#22180b] px-2 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#382c1e]' : 'rounded bg-[#382c1e] px-2 py-1.5 text-center text-[11px] font-semibold text-white hover:bg-[#22180b]'}
        >
          {showSample && product.purchase.buy ? 'Request quote' : 'View'}
        </Link>
      </div>
    </article>
  )
}
