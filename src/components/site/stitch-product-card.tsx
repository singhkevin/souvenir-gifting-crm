import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { AddToCartButton } from '@/components/site/add-to-cart-button'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

function retailFallback(product: PublicProduct) {
  if (product.purchase.reason === 'zero-stock') return { href: `/request-quote?product=${product.id}`, label: 'Notify me' }
  return { href: `/request-quote?product=${product.id}`, label: 'Enquire for custom' }
}

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
  const priced = amount != null && amount > 0
  const fallback = retailFallback(product)

  if (retail) {
    return (
      <article className="group flex h-full flex-col overflow-hidden rounded border border-cream-border bg-cream-card shadow-sm transition-[transform,border-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:border-saffron-border hover:shadow-md">
        <Link href={destination} className="block text-inherit">
          <div className="relative aspect-square overflow-hidden bg-cream-surface">
            <ProductImage
              src={product.image_url}
              alt={product.name}
              size="md"
              fit="contain"
              className="absolute inset-0 h-full w-full bg-transparent transition-transform duration-150 ease-out group-hover:scale-[1.03]"
            />
            {product.purchase.buy ? (
              <span className="absolute top-2 left-2 border border-success bg-success-bg px-2 py-0.5 font-mono text-[11px] font-medium tracking-[0.04em] text-success uppercase">
                In stock
              </span>
            ) : null}
          </div>
          <div className="px-3 pt-3">
            {product.sku ? (
              <p className="truncate font-mono text-[11px] font-medium tracking-[0.06em] text-ink-tertiary uppercase">{product.sku}</p>
            ) : null}
            <h3 className="store-product-title mt-1 line-clamp-2 text-base">{product.name}</h3>
            {priced ? <p className="store-price mt-2">{formatCurrency(amount)}</p> : null}
          </div>
        </Link>
        <div className="mt-auto px-3 pt-3 pb-3">
          {showSample && product.purchase.buy ? (
            <AddToCartButton
              instant
              maxQuantity={product.purchase.maxBuyQty}
              label="Add to cart"
              product={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: amount,
                image_url: product.image_url,
              }}
              className="inline-flex min-h-11 w-full items-center justify-center bg-saffron px-3 text-sm font-bold text-charcoal hover:bg-saffron-hover"
            />
          ) : (
            <Link
              href={fallback.href}
              className="inline-flex min-h-11 w-full items-center justify-center border border-ink text-sm font-semibold text-ink hover:bg-cream-surface"
            >
              {fallback.label}
            </Link>
          )}
        </div>
      </article>
    )
  }

  return (
    <article className="flex h-full flex-col rounded border border-cream-border bg-cream-card p-3 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-saffron-border hover:shadow-md">
      <Link href={destination} className="block text-inherit">
        <div className="relative aspect-square overflow-hidden rounded-sm bg-cream-surface">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            className="absolute inset-0 h-full w-full bg-transparent"
          />
          {product.purchase.buy && showSample ? (
            <span className="absolute top-2 left-2 border border-cream-border bg-saffron-tint px-1.5 py-0.5 text-[10px] font-semibold text-ink">
              Sample available
            </span>
          ) : null}
        </div>
        {meta ? <p className="mt-2 truncate font-mono text-[10px] font-medium tracking-[0.06em] text-gold-deep uppercase">{meta}</p> : null}
        <h3 className="store-product-title mt-1 line-clamp-2 text-sm">{product.name}</h3>
        <p className="store-price mt-2 text-base">{priced ? formatCurrency(amount) : 'Request quotation'}</p>
        <p className="text-xs font-medium text-ink-secondary">
          {caption || (product.moq ? `MOQ ${product.moq}` : showSample ? 'One sample, or request a quote' : 'Request a quote')}
        </p>
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-cream-border pt-2">
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
            className="rounded-sm border border-cream-border bg-cream-surface px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:bg-cream"
          />
        ) : (
          <Link href={quoteHref} className="rounded-sm border border-cream-border bg-cream-surface px-2 py-1.5 text-center text-[11px] font-semibold text-ink hover:bg-cream">
            Request quote
          </Link>
        )}
        <Link
          href={showSample && product.purchase.buy ? quoteHref : destination}
          className="rounded-sm bg-charcoal px-2 py-1.5 text-center text-[11px] font-semibold text-cream hover:bg-charcoal-surface"
        >
          {showSample && product.purchase.buy ? 'Request quote' : 'View'}
        </Link>
      </div>
    </article>
  )
}
