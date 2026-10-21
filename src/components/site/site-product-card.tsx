import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { formatCurrency, cn } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

/**
 * Retail product tile inspired by craft storefronts:
 * square card with 1px hairline border, studio image, Newsreader title + mono price.
 */
export function SiteProductCard({
  product,
  featured = false,
  href,
  priceText,
  caption,
  hideQuickAdd = false,
}: {
  product: PublicProduct
  featured?: boolean
  showBadge?: boolean
  href?: string
  priceText?: string
  caption?: string
  hideQuickAdd?: boolean
}) {
  const displayPrice = priceText || (product.price == null ? 'Price on quote' : formatCurrency(product.price))

  return (
    <article className="group flex h-full flex-col border border-[#CCC5BD] bg-[#FCF9F2] transition-colors hover:border-[#000000]">
      <Link
        href={href || `/catalogue/${product.id}`}
        className="block flex-1 text-inherit focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#000000]"
      >
        <div
          className={cn(
            'relative overflow-hidden bg-[#F1EEE7] border-b border-[#CCC5BD]',
            featured ? 'aspect-[4/5]' : 'aspect-square',
          )}
        >
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent sv2-img-zoom"
          />
          {product.purchase.buy ? (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 sv2-mono-sm text-[10px] text-[#1C1C18] font-semibold">
              READY TO SHIP
            </span>
          ) : (
            <span className="absolute left-2.5 top-2.5 border border-[#CCC5BD] bg-[#FCF9F2] px-2 py-0.5 sv2-mono-sm text-[10px] text-[#7C766F]">
              ON QUOTE
            </span>
          )}
        </div>

        <div className="p-3 sm:p-3.5 flex flex-col justify-between">
          <div>
            {product.category_name ? (
              <p className="truncate font-sans text-[11px] font-semibold text-[#9E4300] uppercase tracking-wider mb-1">
                {product.category_name}
              </p>
            ) : null}
            <h3
              className={cn(
                'line-clamp-2 text-[#1C1C18] font-serif font-normal',
                featured ? 'text-lg leading-snug' : 'text-[15px] sm:text-[16px] leading-snug min-h-10',
              )}
            >
              {product.name}
            </h3>
          </div>

          <div className="mt-3 pt-2 border-t border-[#CCC5BD]/50 flex items-baseline justify-between gap-2">
            <span className="sv2-mono-md font-bold text-[#1C1C18]">
              {displayPrice}
            </span>
            <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase truncate">
              {caption || (product.purchase.buy ? 'Add to bag' : 'Request quote')}
            </span>
          </div>
        </div>
      </Link>

      {!hideQuickAdd && product.purchase.buy ? (
        <div className="p-2.5 border-t border-[#CCC5BD] bg-[#F6F3EC]">
          <AddToCartButton
            compact
            maxQuantity={product.purchase.maxBuyQty}
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
            }}
            label="Add to bag"
            className="w-full flex items-center justify-center border border-[#000000] bg-[#000000] hover:bg-[#9E4300] hover:border-[#9E4300] py-2 sv2-label text-[10px] text-white tracking-wider transition-colors"
          />
        </div>
      ) : null}
    </article>
  )
}
