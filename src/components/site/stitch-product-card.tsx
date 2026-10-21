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
  const meta = [product.category_name, product.brand_name].filter(Boolean).join(' // ')

  return (
    <article className="group flex h-full flex-col border border-[#CCC5BD] bg-[#FCF9F2] transition-colors hover:border-[#000000]">
      <Link
        href={destination}
        className="block flex-1 text-inherit focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#000000]"
      >
        {/* Product Image Stage */}
        <div className="relative aspect-square overflow-hidden bg-[#F1EEE7] border-b border-[#CCC5BD]">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent sv2-img-zoom"
          />
          {product.purchase.buy && showSample ? (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 sv2-mono-sm text-[10px] text-[#1C1C18] font-semibold">
              READY TO SHIP
            </span>
          ) : (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 sv2-mono-sm text-[10px] text-[#7C766F]">
              ON QUOTE
            </span>
          )}
        </div>

        {/* Product Meta */}
        <div className="p-3 sm:p-3.5 flex flex-col justify-between">
          <div>
            {meta ? (
              <p className="truncate font-sans text-[11px] font-semibold text-[#9E4300] uppercase tracking-wider mb-1">
                {meta}
              </p>
            ) : null}
            <h3 className="line-clamp-2 font-serif text-[15px] sm:text-[17px] leading-snug text-[#1C1C18] font-normal min-h-10">
              {product.name}
            </h3>
          </div>
          <div className="mt-3 pt-2 border-t border-[#CCC5BD]/50 flex items-baseline justify-between gap-2">
            <span className="sv2-mono-md font-bold text-[#1C1C18]">
              {amount == null ? 'Price on quote' : formatCurrency(amount)}
            </span>
            <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase truncate">
              {caption || (product.moq ? `MOQ: ${product.moq}` : 'Single Unit')}
            </span>
          </div>
        </div>
      </Link>

      {/* Button Actions */}
      <div className="mt-auto grid grid-cols-2 gap-1.5 p-2.5 border-t border-[#CCC5BD] bg-[#F6F3EC]">
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
            className="border border-[#000000] bg-[#000000] hover:bg-[#9E4300] hover:border-[#9E4300] px-2 py-2 text-center sv2-label text-[10px] text-white tracking-wider transition-colors"
          />
        ) : (
          <Link
            href={quoteHref}
            className="border border-[#CCC5BD] bg-[#FCF9F2] hover:border-[#000000] px-2 py-2 text-center sv2-label text-[10px] text-[#1C1C18] tracking-wider transition-colors"
          >
            Request quote
          </Link>
        )}
        <Link
          href={showSample && product.purchase.buy ? quoteHref : destination}
          className="border border-[#CCC5BD] bg-[#FCF9F2] hover:border-[#000000] px-2 py-2 text-center sv2-label text-[10px] text-[#1C1C18] tracking-wider transition-colors"
        >
          {showSample && product.purchase.buy ? 'Request quote' : 'View'}
        </Link>
      </div>
    </article>
  )
}
