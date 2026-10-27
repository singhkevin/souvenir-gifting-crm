import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { Chip } from '@/components/sv2/chip'
import { formatCurrency } from '@/lib/utils'

/**
 * SV2 ProductCard — hairline-bordered square card for the Bestsellers grid.
 * Matches the reference: SKU row, square image, serif name, mono spec, price, MOQ chip, CTA.
 */
export function SV2ProductCard({
  id,
  name,
  sku,
  imageUrl,
  description,
  price,
  moq,
  inStock = false,
  priceText,
}: {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  description: string | null
  price: number | null
  moq: number
  inStock?: boolean
  priceText?: string | null
}) {
  const displayPrice = price != null && price > 0

  return (
    <article className="flex flex-col justify-between border border-[#CCC5BD] bg-[#FCF9F2]">
      {/* SKU row */}
      <div>
        <div className="flex items-center justify-between border-b border-[#CCC5BD] px-2 py-1 sm:py-1.5">
          <span className="sv2-mono-sm text-[10px] sm:text-[11px] text-[#7C766F] truncate max-w-[120px]">
            {sku ? `SKU: ${sku}` : '\u00A0'}
          </span>
          {inStock && (
            <span className="sv2-label font-semibold text-[9px] sm:text-[10px] text-[#9E4300]">IN STOCK</span>
          )}
        </div>

        {/* Image */}
        <div className="aspect-square overflow-hidden bg-[#F1EEE7]">
          {imageUrl ? (
            <ProductImage
              src={imageUrl}
              alt={name}
              fit="cover"
              className="h-full w-full sv2-img-zoom"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#7C766F] sv2-body-sm text-xs">
              No image
            </div>
          )}
        </div>

        {/* Title + spec */}
        <div className="border-t border-[#CCC5BD] p-2 sm:p-3">
          <h4 className="sv2-headline-sm text-[15px] sm:text-[18px] leading-tight text-[#1C1C18] mb-1 line-clamp-2">
            {name}
          </h4>
          {description && (
            <p className="sv2-body-sm text-[11px] sm:text-xs text-[#7C766F] line-clamp-1">{description}</p>
          )}
        </div>
      </div>

      {/* Price + CTA */}
      <div className="border-t border-[#CCC5BD] p-2 sm:p-3 bg-[#F6F3EC]">
        <div className="flex flex-wrap items-baseline justify-between gap-1 mb-2">
          <span className={priceText ? 'text-xs font-medium leading-snug text-[#4A4640]' : 'sv2-mono-sm sm:sv2-mono-md font-bold text-[#1C1B1A]'}>
            {priceText || (displayPrice ? formatCurrency(price) : 'Price on quote')}
          </span>
          <Chip>MOQ: {moq}</Chip>
        </div>
        <Link
          href={`/request-quote?product=${encodeURIComponent(id)}`}
          className="block w-full text-center bg-[#000000] hover:bg-[#9E4300] text-white py-1.5 sm:py-2 sv2-label text-[10px] sm:text-[11px] tracking-wider transition-colors duration-150"
        >
          Request Quote
        </Link>
      </div>
    </article>
  )
}
