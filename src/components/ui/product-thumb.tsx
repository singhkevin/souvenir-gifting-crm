import { ProductImage } from '@/components/ui/product-image'
import { cn } from '@/lib/utils'

/**
 * Small square product thumbnail for lists, tables, pickers and line items.
 * Fixed box (no layout shift), object-cover, square corners, no shadow.
 * Lazy-loads through ProductImage and falls back to the neutral Souvenir placeholder.
 */
export function ProductThumb({
  src,
  alt,
  size = 40,
  className,
}: {
  src?: string | null
  alt?: string | null
  size?: number
  className?: string
}) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded-none', className)}
      style={{ width: size, height: size }}
      data-product-thumb=""
    >
      <ProductImage src={src} alt={alt || 'Product'} size="xs" fit="cover" className="h-full w-full rounded-none" />
    </div>
  )
}
