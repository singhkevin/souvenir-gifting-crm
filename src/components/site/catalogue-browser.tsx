'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LayoutGrid, List } from 'lucide-react'
import { SiteProductCard } from '@/components/site/site-product-card'
import { formatCurrency } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import type { PublicProduct } from '@/lib/catalogue/products'

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
    return <p className="py-20 text-center text-sm text-ink-secondary">No gifts match these filters.</p>
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <div className="inline-flex overflow-hidden rounded border border-cream-border">
          <button
            type="button"
            onClick={() => choose('grid')}
            aria-pressed={view === 'grid'}
            className={`inline-flex min-h-11 items-center gap-2 px-3 font-mono text-[11px] tracking-[0.08em] uppercase ${
              view === 'grid' ? 'bg-charcoal text-cream' : 'bg-cream-card text-ink-secondary'
            }`}
          >
            <LayoutGrid size={13} /> Grid
          </button>
          <button
            type="button"
            onClick={() => choose('list')}
            aria-pressed={view === 'list'}
            className={`inline-flex min-h-11 items-center gap-2 px-3 font-mono text-[11px] tracking-[0.08em] uppercase ${
              view === 'list' ? 'bg-charcoal text-cream' : 'bg-cream-card text-ink-secondary'
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
        <div className="divide-y divide-cream-border border-y border-cream-border">
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
                <p className="font-mono text-[10px] tracking-[0.08em] text-gold-deep uppercase">{product.category_name}</p>
                <p className="store-product-title mt-1 truncate text-base">{product.name}</p>
                <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-ink-tertiary uppercase">{product.sku}</p>
              </div>
              <div className="text-right">
                <p className="store-price text-base">{priceLabel?.(product) || (product.price != null && product.price > 0 ? formatCurrency(product.price) : '—')}</p>
                <p className="mt-1 font-mono text-[10px] tracking-[0.06em] text-ink-secondary uppercase">{captionFor?.(product) || (product.purchase.buy ? 'In stock' : product.purchase.reason === 'zero-stock' ? 'Notify me' : 'Enquire for custom')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
