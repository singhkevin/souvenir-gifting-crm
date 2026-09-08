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
        <h2 className="text-lg font-semibold text-gray-900">Catalogue shortlist</h2>
        <p className="mt-1 text-sm text-gray-500">Gifts you saved from Explore gifts. Use these when creating a requirement.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ProductImage src={item.image_url} alt={item.name} size="md" />
            <div className="flex flex-1 flex-col gap-3 p-4">
              {item.category_name ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1A3022]">{item.category_name}</p>
              ) : null}
              <Link href={`/portal/catalogue/product/${item.id}`}>
                <h3 className="font-semibold text-gray-900 hover:text-[#1A3022]">{item.name}</h3>
              </Link>
              <p className="text-sm text-gray-600">
                {formatCurrency(item.price)} · {item.sku}
              </p>
              <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                <Link
                  href={`/portal/catalogue/product/${item.id}`}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
                >
                  View
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    toggleCatalogueShortlist(item)
                    setItems(readCatalogueShortlist())
                  }}
                  className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Heart size={14} className="fill-current" />
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Link
        href="/portal/requirements/new"
        className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-4 text-sm font-semibold text-white hover:bg-[#274433] sm:w-auto"
      >
        Create requirement from shortlist
      </Link>
    </section>
  )
}
