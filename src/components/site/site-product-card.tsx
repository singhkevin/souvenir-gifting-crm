import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { cn } from '@/lib/utils'

/**
 * Product listing: one studio tone, feathered photo edges — no nested mats.
 */
export function SiteProductCard({
  product,
  featured = false,
}: {
  product: PublicProduct
  featured?: boolean
  /** @deprecated kept for call-site compatibility; badges removed for cleaner listing */
  showBadge?: boolean
}) {
  return (
    <Link
      href={`/catalogue/${product.id}`}
      className={cn(
        'group block text-inherit transition-transform duration-300 hover:text-inherit motion-reduce:transition-none',
        'hover:-translate-y-0.5',
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-[1.35rem] catalogue-studio-field',
          'shadow-[0_8px_24px_rgba(26,48,34,0.06)]',
          'transition-shadow duration-300 group-hover:shadow-[0_14px_32px_rgba(26,48,34,0.1)]',
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
          imgClassName="catalogue-product-img scale-[1.04]"
        />
      </div>

      <div className="mt-3.5 space-y-1 px-0.5 text-center sm:mt-4">
        {product.category_name ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#7A7267]">
            {product.category_name}
          </p>
        ) : null}
        <h3
          className={cn(
            'text-[#1C1917] line-clamp-2',
            featured ? 'font-serif text-xl leading-snug' : 'text-[14px] font-medium leading-snug sm:text-[15px]',
          )}
        >
          {product.name}
        </h3>
        <p className="text-[15px] font-semibold text-[#1A3022]">{formatCurrency(product.price)}</p>
      </div>
    </Link>
  )
}
