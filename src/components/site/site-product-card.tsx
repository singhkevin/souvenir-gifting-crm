import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { cn } from '@/lib/utils'

export function SiteProductCard({
  product,
  featured = false,
}: {
  product: PublicProduct
  featured?: boolean
}) {
  return (
    <Link
      href={`/catalogue/${product.id}`}
      className={cn('group block text-inherit hover:text-inherit', featured ? 'space-y-4' : 'space-y-3')}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-[#E8E2D8]',
          featured ? 'aspect-[4/5]' : 'aspect-square',
        )}
      >
        <ProductImage
          src={product.image_url}
          alt={product.name}
          size="md"
          fit="cover"
          className="h-full min-h-0 w-full bg-[#E8E2D8]"
          imgClassName="catalogue-fill-zoom transition-transform duration-700 ease-out"
        />
        <div className="pointer-events-none absolute inset-0 bg-[#1A3022]/0 transition-colors duration-500 group-hover:bg-[#1A3022]/22 motion-reduce:group-hover:bg-transparent" />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 px-4 py-4 text-[11px] font-medium uppercase tracking-[0.18em] text-[#FAF7F2] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 max-lg:translate-y-0 max-lg:opacity-100 max-lg:bg-gradient-to-t max-lg:from-[#1A3022]/70 max-lg:pt-10 motion-reduce:hidden">
          View Product →
        </span>
      </div>
      <div className="space-y-1">
        {product.category_name && (
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#5A5348]">
            {product.category_name}
          </p>
        )}
        <h3
          className={cn(
            'text-[#1C1917] line-clamp-2',
            featured ? 'font-serif text-2xl leading-snug' : 'text-[15px] font-medium leading-snug',
          )}
        >
          {product.name}
        </h3>
        <p className="text-sm font-medium text-[#1A3022]">{formatCurrency(product.price)}</p>
      </div>
    </Link>
  )
}
