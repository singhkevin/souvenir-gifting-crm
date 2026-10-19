import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { cn } from '@/lib/utils'

function fallbackLabel(product: PublicProduct) {
  return product.purchase.reason === 'zero-stock' ? 'Notify me' : 'Enquire for custom'
}

/**
 * Retail catalogue tile: cream image well, INR price, one Add to cart.
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
  const priced = product.price != null && product.price > 0
  const destination = href || `/catalogue/${product.id}`

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded border border-cream-border bg-cream-card shadow-sm transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-saffron-border hover:shadow-md">
      <Link href={destination} className="block text-inherit">
        <div
          className={cn(
            'relative overflow-hidden bg-cream-surface',
            featured ? 'aspect-[4/5]' : 'aspect-square',
          )}
        >
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent transition-transform duration-150 ease-out group-hover:scale-[1.03]"
          />
          {product.purchase.buy && !hideQuickAdd ? (
            <span className="absolute top-2 left-2 border border-success bg-success-bg px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-success uppercase">
              In stock
            </span>
          ) : null}
        </div>
        <div className="px-3 pt-3">
          {product.sku ? (
            <p className="truncate font-mono text-[11px] font-medium tracking-[0.06em] text-ink-tertiary uppercase">{product.sku}</p>
          ) : null}
          <h3 className={cn('store-product-title mt-1 line-clamp-2', featured ? 'text-lg' : 'text-base')}>{product.name}</h3>
          <p className="store-price mt-2">{priceText || (priced ? formatCurrency(product.price) : null)}</p>
          {caption ? <p className="mt-1 text-xs text-ink-secondary">{caption}</p> : null}
        </div>
      </Link>
      {hideQuickAdd ? null : (
        <div className="mt-auto px-3 pt-3 pb-3">
          {product.purchase.buy ? (
            <AddToCartButton
              instant
              maxQuantity={product.purchase.maxBuyQty}
              label="Add to cart"
              product={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                image_url: product.image_url,
              }}
              className="inline-flex min-h-11 w-full items-center justify-center bg-saffron px-3 text-sm font-bold text-charcoal hover:bg-saffron-hover"
            />
          ) : (
            <Link
              href={`/request-quote?product=${product.id}`}
              className="inline-flex min-h-11 w-full items-center justify-center border border-ink text-sm font-semibold text-ink hover:bg-cream-surface"
            >
              {fallbackLabel(product)}
            </Link>
          )}
        </div>
      )}
    </article>
  )
}
