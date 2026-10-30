'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List } from 'lucide-react'
import { SiteProductCard } from '@/components/site/site-product-card'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'
import { retailLineCaption } from '@/lib/catalogue/availability'
import { purchaseCaption } from '@/lib/catalogue/purchase-path'

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
    return <p className="py-20 text-center sv2-body-md text-[#4A4640]">No gifts match these filters.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="inline-flex border border-[#CCC5BD] bg-[#F6F3EC] p-0.5">
          <button
            type="button"
            onClick={() => choose('grid')}
            aria-pressed={view === 'grid'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sv2-label text-[10px] tracking-wider transition-colors ${
              view === 'grid' ? 'bg-[#000000] text-white' : 'text-[#4A4640] hover:text-[#1C1C18]'
            }`}
          >
            <LayoutGrid size={13} /> Grid
          </button>
          <button
            type="button"
            onClick={() => choose('list')}
            aria-pressed={view === 'list'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sv2-label text-[10px] tracking-wider transition-colors ${
              view === 'list' ? 'bg-[#000000] text-white' : 'text-[#4A4640] hover:text-[#1C1C18]'
            }`}
          >
            <List size={13} /> List
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
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
        <div className="divide-y divide-[#CCC5BD] border-y border-[#CCC5BD] bg-[#FCF9F2]">
          {products.map((product) => (
            <Link
              key={product.id}
              href={hrefFor?.(product) || `/catalogue/${product.id}`}
              className="grid grid-cols-[5rem_1fr_auto] items-center gap-4 p-4 text-inherit hover:bg-[#F6F3EC] transition-colors sm:grid-cols-[6.5rem_1fr_auto] sm:gap-6"
            >
              <div className="aspect-square overflow-hidden border border-[#CCC5BD] bg-[#F1EEE7]">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  size="sm"
                  fit="contain"
                  className="h-full w-full min-h-0 bg-transparent"
                />
              </div>
              <div className="min-w-0">
                {product.category_name ? (
                  <p className="font-sans text-[11px] font-semibold uppercase text-[#9E4300] tracking-wider">{product.category_name}</p>
                ) : null}
                <p className="mt-1 font-serif text-lg text-[#1C1C18] truncate font-normal">{product.name}</p>
                <p className="mt-0.5 sv2-mono-sm text-xs text-[#7C766F]">{product.sku}</p>
              </div>
              <div className="text-right">
                <p className="sv2-mono-md font-bold text-[#1C1C18]">
                  {priceLabel?.(product) || (product.price == null ? 'Price on quote' : formatCurrency(product.price))}
                </p>
                <p className="mt-0.5 sv2-label text-[10px] text-[#7C766F]">
                  {captionFor?.(product) || (product.purchase.rfq ? purchaseCaption(product.purchase) : retailLineCaption(product.purchase.stockQty))}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
