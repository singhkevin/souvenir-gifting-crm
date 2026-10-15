'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List } from 'lucide-react'
import { SiteProductCard } from '@/components/site/site-product-card'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'
import { retailStatusLabel } from '@/lib/catalogue/storefront'

const VIEW_KEY = 'giffter.public-catalogue.view'

type CatalogueItem = PublicProduct & {
  indicativePrice?: number | null
  moqUnits?: number
}

export function CatalogueBrowser({
  products,
  hrefFor,
  priceLabel,
  captionFor,
  hideQuickAdd = false,
}: {
  products: CatalogueItem[]
  hrefFor?: (product: CatalogueItem) => string
  priceLabel?: (product: CatalogueItem) => string
  captionFor?: (product: CatalogueItem) => string
  hideQuickAdd?: boolean
}) {
  const [view, setView] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      try {
        const saved = window.localStorage.getItem(VIEW_KEY)
        if (saved === 'list' || saved === 'grid') setView(saved)
      } catch {
        // Preference is optional.
      }
    })
    return () => {
      active = false
    }
  }, [])

  const choose = (next: 'grid' | 'list') => {
    setView(next)
    try {
      window.localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Ignore storage failures.
    }
  }

  if (products.length === 0) {
    return <p className="py-20 text-center text-sm text-[#5C6570]">No gifts match these filters.</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <div className="inline-flex overflow-hidden rounded-md border border-[#eadfd4]">
          <button
            type="button"
            onClick={() => choose('grid')}
            aria-pressed={view === 'grid'}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.14em] ${
              view === 'grid' ? 'bg-[#22180b] text-white' : 'bg-white text-[#4d453e]'
            }`}
          >
            <LayoutGrid size={13} /> Grid
          </button>
          <button
            type="button"
            onClick={() => choose('list')}
            aria-pressed={view === 'list'}
            className={`inline-flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-[0.14em] ${
              view === 'list' ? 'bg-[#22180b] text-white' : 'bg-white text-[#4d453e]'
            }`}
          >
            <List size={13} /> List
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-6 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <SiteProductCard
              key={product.id}
              product={product}
              href={hrefFor?.(product)}
              priceText={priceLabel?.(product)}
              caption={captionFor?.(product)}
              hideQuickAdd={hideQuickAdd}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-[#E8E4DE] border-y border-[#E8E4DE]">
          {products.map((product) => (
            <Link
              key={product.id}
              href={hrefFor?.(product) || `/catalogue/${product.id}`}
              className="grid grid-cols-[5rem_1fr_auto] items-center gap-4 py-4 text-inherit hover:text-inherit sm:grid-cols-[6.5rem_1fr_auto] sm:gap-5"
            >
              <div className="aspect-square overflow-hidden rounded-md catalogue-studio-field">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  size="sm"
                  fit="contain"
                  fadeEdges
                  className="h-full w-full min-h-0 bg-transparent"
                  imgClassName="catalogue-product-img"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[#5C6570]">{product.category_name}</p>
                <p className="mt-1 truncate font-medium text-[#1B2430]">{product.name}</p>
                <p className="mt-1 font-mono text-[10px] text-[#5C6570]">{product.sku}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-[#806A50]">{priceLabel?.(product) || (product.price == null ? '—' : formatCurrency(product.price))}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[#5C6570]">{captionFor?.(product) || retailStatusLabel(product.purchase)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
