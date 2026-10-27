import Link from 'next/link'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'

/**
 * SV2 KitCard — occasion/kit card for the "Shop by Occasion" grid.
 * Hairline-bordered with 4:3 image, serif title, body description, spec data, price + MOQ.
 */
export function SV2KitCard({
  title,
  tag,
  description,
  imageUrl,
  price,
  moq,
  moqUnit = 'Kits',
  href,
  customisation,
  leadTime,
  priceText,
}: {
  title: string
  tag: string
  description: string
  imageUrl: string | null
  price: number | null
  moq: number | null
  moqUnit?: string
  href: string
  customisation?: string
  leadTime?: string
  priceText?: string | null
}) {
  const displayPrice = price != null && price > 0

  return (
    <article className="flex flex-col justify-between border border-[#CCC5BD] bg-[#F6F3EC]">
      <div>
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-[#F1EEE7] border-b border-[#CCC5BD]">
          {imageUrl ? (
            <ProductImage
              src={imageUrl}
              alt={title}
              fit="cover"
              className="h-full w-full sv2-img-zoom"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#7C766F] sv2-body-sm text-xs">
              No image
            </div>
          )}
          {/* Tag badge */}
          <span className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-[#FCF9F2] border border-[#CCC5BD] px-1.5 sm:px-2.5 py-0.5 sm:py-1 sv2-label font-bold text-[9px] sm:text-[11px] text-[#9E4300]">
            {tag}
          </span>
        </div>

        {/* Content */}
        <div className="p-2.5 sm:p-4">
          <h3 className="sv2-headline-sm text-[15px] sm:text-[20px] lg:text-[24px] leading-snug text-[#1C1C18] mb-1 sm:mb-2 line-clamp-2">
            {title}
          </h3>
          <p className="sv2-body-sm text-[11px] sm:text-[13px] text-[#4A4640] mb-2 sm:mb-4 line-clamp-2 sm:line-clamp-none">
            {description}
          </p>

          {/* Spec rows */}
          {(customisation || leadTime) && (
            <div className="border-t border-[#CCC5BD] pt-1.5 sm:pt-2 space-y-1 text-[10px] sm:text-xs">
              {customisation && (
                <div className="flex flex-col sm:flex-row sm:justify-between sv2-body-sm text-[10px] sm:text-xs text-[#7C766F]">
                  <span>Customisation:</span>
                  <span className="text-[#1C1C18] font-medium">{customisation}</span>
                </div>
              )}
              {leadTime && (
                <div className="flex flex-col sm:flex-row sm:justify-between sv2-body-sm text-[10px] sm:text-xs text-[#7C766F]">
                  <span>Lead time:</span>
                  <span className="text-[#1C1C18] font-medium">{leadTime}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Price footer */}
      <div className="border-t border-[#CCC5BD] p-2.5 sm:p-4 bg-[#FCF9F2] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2">
        <div>
          <span className="block sv2-body-sm text-[10px] sm:text-xs text-[#7C766F]">Starting from</span>
          <span className={priceText ? 'block text-xs font-medium leading-snug text-[#4A4640]' : 'sv2-mono-md sm:sv2-mono-lg font-bold text-[#1C1B1A]'}>
            {priceText ? (
              priceText
            ) : displayPrice ? (
              <>
                {formatCurrency(price)}{' '}
                <span className="sv2-body-sm text-[10px] sm:text-xs font-normal text-[#7C766F]">/ kit</span>
              </>
            ) : (
              'Price on quote'
            )}
          </span>
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1">
          {moq != null && moq > 0 && (
            <span className="inline-block bg-[#F1EEE7] border border-[#CCC5BD] px-1.5 sm:px-2 py-0.5 sv2-mono-sm text-[10px] sm:text-[11px] text-[#1C1C18]">
              MOQ: {moq} {moqUnit}
            </span>
          )}
          <Link
            href={href}
            className="block sv2-label font-bold text-[10px] sm:text-[11px] text-[#9E4300] hover:underline"
          >
            Configure →
          </Link>
        </div>
      </div>
    </article>
  )
}
