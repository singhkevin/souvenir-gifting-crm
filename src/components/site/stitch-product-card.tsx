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
  channel = 'retail',
  hiddenPriceLabel,
}: {
  product: PublicProduct
  href?: string
  price?: number | null
  showSample?: boolean
  caption?: string
  tone?: 'default' | 'retail'
  channel?: 'retail' | 'business'
  /** Shown instead of a number when this surface must not reveal a price. */
  hiddenPriceLabel?: string | null
}) {
  const destination = href || `/catalogue/${product.id}`
  const amount = price === undefined ? product.price : price
  const quoteHref = `/request-quote?product=${product.id}`
  const category = product.category_name && !/^other$/i.test(product.category_name) ? product.category_name : null
  const meta = [category, product.brand_name].filter(Boolean).join(' · ')
  const canBuy = Boolean(showSample && product.purchase.buy)
  const moqLine = channel === 'business' ? caption || (product.moq ? `MOQ ${product.moq}` : null) : null

  return (
    <article className="group flex h-full flex-col border border-[#CCC5BD] bg-[#FCF9F2] transition-colors hover:border-[#9E4300] focus-within:border-[#9E4300]">
      <Link
        href={destination}
        aria-label={`View ${product.name}`}
        className="block flex-1 text-inherit focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#9E4300]"
      >
        {/* Product Image Stage */}
        <div className="relative aspect-[4/5] overflow-hidden bg-[#F6F3EC]">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fit="cover"
            className="absolute inset-0 h-full w-full bg-transparent"
            imgClassName="scale-[1.04] transition-transform duration-500 group-hover:scale-[1.1] motion-reduce:transition-none motion-reduce:group-hover:scale-[1.04]"
          />
          {canBuy ? (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-[#1C1C18]">
              Ready to ship
            </span>
          ) : (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-[#7C766F]">
              On quote
            </span>
          )}
        </div>

        {/* Product Meta */}
        <div className="flex flex-col gap-1 px-3 py-3 sm:px-3.5">
          {meta ? (
            <p className="truncate font-sans text-[11px] font-semibold uppercase tracking-wider text-[#9E4300]">{meta}</p>
          ) : null}
          <h3 className="line-clamp-2 font-serif text-[15px] sm:text-[17px] leading-snug text-[#1C1C18] font-normal">
            {product.name}
          </h3>
          <span className={amount == null && hiddenPriceLabel ? 'text-xs font-medium leading-snug text-[#4A4640]' : 'sv2-mono-md font-bold text-[#1C1C18]'}>
            {amount == null ? (hiddenPriceLabel || 'Price on quote') : formatCurrency(amount)}
          </span>
          {moqLine ? <span className="truncate sv2-mono-sm text-[11px] text-[#7C766F]">{moqLine}</span> : null}
        </div>
      </Link>

      {/* Button Actions */}
      <div
        className={`mt-auto grid gap-1.5 border-t border-[#CCC5BD] bg-[#F6F3EC] p-2.5 ${
          canBuy && product.purchase.rfq ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {canBuy ? (
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
            className="border border-[#000000] bg-[#000000] hover:bg-[#9E4300] hover:border-[#9E4300] px-2 py-2 text-center sv2-label text-[10px] text-white tracking-wider transition-colors"
          />
        ) : null}
        {!canBuy || product.purchase.rfq ? (
          <Link
            href={quoteHref}
            className="border border-[#CCC5BD] bg-[#FCF9F2] hover:border-[#9E4300] px-2 py-2 text-center sv2-label text-[10px] text-[#1C1C18] tracking-wider transition-colors"
          >
            Request quote
          </Link>
        ) : null}
      </div>
    </article>
  )
}
