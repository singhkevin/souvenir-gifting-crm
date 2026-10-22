'use client'

import { useRouter } from 'next/navigation'
import {
  isCatalogueShortlisted,
  toggleCatalogueShortlist,
  type CatalogueShortlistItem,
} from '@/lib/portal/catalogue-shortlist'

/** Opens the existing portal requirement, which is the quote path for the company catalogue. */
export function RequestQuoteButton({
  product,
  className,
}: {
  product: CatalogueShortlistItem
  className?: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      className={
        className ||
        'inline-flex items-center justify-center rounded-none bg-[#000000] px-5 py-2.5 sv2-label text-[11px] text-white transition-colors hover:bg-[#9E4300]'
      }
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!isCatalogueShortlisted(product.id) && !isCatalogueShortlisted(product.sku)) {
          toggleCatalogueShortlist(product)
        }
        router.push('/portal/requirements/new')
      }}
    >
      Request quote
    </button>
  )
}
