import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
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
}: {
  product: PublicProduct
  featured?: boolean
  showBadge?: boolean
}) {
  return (
    <Link
      href={`/catalogue/${product.id}`}
      className="group block text-inherit hover:text-inherit"
    >
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
        <p className="text-[15px] font-semibold text-[#1A3022]">{formatCurrency(product.price)}</p>
      </div>
    </Link>
  )
}
