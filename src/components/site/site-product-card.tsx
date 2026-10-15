import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { RetailBuyActions } from '@/components/site/retail-buy'
import { retailStatusLabel } from '@/lib/catalogue/storefront'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { cn } from '@/lib/utils'

/**
 * Retail product tile inspired by craft storefronts:
 * clean white card, studio image, name + price.
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
  const destination = href || `/catalogue/${product.id}`
  const status = caption || (hideQuickAdd ? '' : retailStatusLabel(product.purchase))

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#eadfd4] bg-white p-2.5 text-inherit shadow-[0_8px_24px_rgba(34,24,11,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d7c4a4]">
      <Link href={destination} className="block text-inherit hover:text-inherit">
        <div
          className={cn(
            'relative overflow-hidden rounded-md catalogue-studio-field',
            'transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none',
            featured ? 'aspect-[4/5]' : 'aspect-square',
          )}
        >
          <ProductImage
            src={product.image_url}
            alt={product.name}
            size="md"
            fit="contain"
            fadeEdges
            className="absolute inset-0 h-full w-full bg-transparent"
            imgClassName="catalogue-product-img scale-[1.03]"
          />
        </div>

        <div className="mt-3 space-y-1 px-0.5 text-center">
          <h3
            className={cn(
              'line-clamp-2 text-[#1B2430]',
              featured ? 'font-serif text-xl leading-snug' : 'text-[13px] leading-snug sm:text-sm',
            )}
          >
            {product.name}
          </h3>
          <p className="text-[15px] font-semibold text-[#806A50]">{priceText || (product.price == null ? '—' : formatCurrency(product.price))}</p>
          {status ? (
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#5C6570]">{status}</p>
          ) : null}
        </div>
      </Link>
      {hideQuickAdd ? null : (
        <div className="mt-2">
          <RetailBuyActions
            product={{
              id: product.id,
              sku: product.sku,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
              purchase: product.purchase,
            }}
          />
        </div>
      )}
    </article>
  )
}
