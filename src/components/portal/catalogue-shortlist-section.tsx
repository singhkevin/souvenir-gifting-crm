'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import {
  type CatalogueShortlistItem,
  readCatalogueShortlist,
  toggleCatalogueShortlist,
} from '@/lib/portal/catalogue-shortlist'

export function CatalogueShortlistSection() {
  const [items, setItems] = useState<CatalogueShortlistItem[]>([])

  useEffect(() => {
    const sync = () => setItems(readCatalogueShortlist())
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-shortlist-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-shortlist-change', sync)
    }
  }, [])

  if (items.length === 0) return null

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="border border-[#CCC5BD] bg-[#F1EEE7] px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#9E4300]">
            SAVED GIFTS
          </span>
          <h2 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal tracking-tight text-[#1C1C18] sm:text-3xl">
            Saved gifts
          </h2>
        </div>
        <p className="mt-1 text-sm text-[#4A4640]">Gifts you added from All gifts.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col justify-between overflow-hidden rounded-none border border-[#CCC5BD] bg-[#FCF9F2]"
          >
            <div className="border-b border-[#CCC5BD]">
              <ProductImage src={item.image_url} alt={item.name} size="md" />
            </div>
            <div className="flex flex-1 flex-col justify-between gap-4 p-5">
              <div>
                {item.category_name ? (
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#9E4300]">
                    {item.category_name}
                  </p>
                ) : null}
                <Link href={`/portal/gifts/${item.id}`} className="group block">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18] transition-colors group-hover:text-[#9E4300] sm:text-xl">
                    {item.name}
                  </h3>
                </Link>
                <p className="mt-2 font-[family-name:var(--font-mono)] text-xs text-[#4A4640] sm:text-sm">
                  {formatCurrency(item.price)} · SKU: {item.sku}
                </p>
              </div>
              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/portal/gifts/${item.id}`}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-3 py-2 sv2-label text-[11px] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC]"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleCatalogueShortlist(item)
                    setItems(readCatalogueShortlist())
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-none border border-[#CCC5BD] bg-transparent px-3 py-2 sv2-label text-[11px] text-[#BA1A1A] transition-colors hover:border-[#BA1A1A] hover:bg-[#FFDAD6]/30"
                >
                  <Heart size={14} className="fill-current" />
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
