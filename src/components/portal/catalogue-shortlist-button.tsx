'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import {
  type CatalogueShortlistItem,
  isCatalogueShortlisted,
  toggleCatalogueShortlist,
} from '@/lib/portal/catalogue-shortlist'

export function CatalogueShortlistButton({
  product,
  variant = 'card',
}: {
  product: CatalogueShortlistItem
  variant?: 'card' | 'detail'
}) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const sync = () => setActive(isCatalogueShortlisted(product.id) || isCatalogueShortlisted(product.sku))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-shortlist-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-shortlist-change', sync)
    }
  }, [product.id, product.sku])

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const next = toggleCatalogueShortlist(product)
        setActive(next)
      }}
      className={
        variant === 'detail'
          ? `inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-none px-4 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              active
                ? 'border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                : 'border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300]'
            }`
          : `inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-none px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
              active
                ? 'border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                : 'border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300]'
            }`
      }
      aria-pressed={active}
    >
      <Heart size={13} className={active ? 'fill-current text-[#3A4537]' : ''} />
      {active ? 'Added' : 'Add to quote'}
    </button>
  )
}
