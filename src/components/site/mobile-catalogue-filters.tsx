'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MobileFilterSheetOption,
  MobileFilterSheetShell,
  MobileFilterTrigger,
} from '@/components/ui/mobile-filter-sheet'
import { PriceRangeFilter } from '@/components/site/price-range-filter'
import { formatCurrency } from '@/lib/utils'

type CategoryOption = { id: string; name: string }
type BrandOption = { id: string; name: string }

const SORT_OPTIONS = [
  { value: 'name', label: 'A–Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
] as const

export function MobileCatalogueFilters({
  categories,
  categoryFilter,
  brands,
  brandFilter,
  priceBounds,
  priceMin,
  priceMax,
  search,
  sort,
  categoryCounts,
  brandCounts,
  productTotal,
}: {
  categories: CategoryOption[]
  categoryFilter: string
  brands: BrandOption[]
  brandFilter: string
  priceBounds: { min: number; max: number }
  priceMin: number
  priceMax: number
  search: string
  sort: string
  categoryCounts: Record<string, number>
  brandCounts: Record<string, number>
  productTotal: number
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState<'category' | 'brand' | 'price' | 'sort' | null>(null)

  const priceIsFiltered = priceMin > priceBounds.min || priceMax < priceBounds.max

  const go = (overrides: { category?: string; brand?: string; sort?: string }) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const nextCategory = overrides.category !== undefined ? overrides.category : categoryFilter
    const nextBrand = overrides.brand !== undefined ? overrides.brand : brandFilter
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort
    if (nextCategory) params.set('category', nextCategory)
    if (nextBrand) params.set('brand', nextBrand)
    if (priceMin > priceBounds.min) params.set('priceMin', String(priceMin))
    if (priceMax < priceBounds.max) params.set('priceMax', String(priceMax))
    if (nextSort && nextSort !== 'name') params.set('sort', nextSort)
    const qs = params.toString()
    setSheet(null)
    router.push(`/catalogue${qs ? `?${qs}` : ''}`)
  }

  const categoryLabel =
    categories.find((item) => item.id === categoryFilter)?.name || 'All gifts'
  const brandLabel = brands.find((item) => item.id === brandFilter)?.name || 'All brands'
  const priceLabel = priceIsFiltered
    ? `${formatCurrency(priceMin)} – ${formatCurrency(priceMax)}`
    : 'Any price'
  const sortLabel = SORT_OPTIONS.find((item) => item.value === sort)?.label || 'A–Z'

  const hasFilters = Boolean(search || categoryFilter || brandFilter || priceIsFiltered || (sort && sort !== 'name'))

  return (
    <div className="mt-5 space-y-3 lg:hidden">
      <div className="grid grid-cols-2 gap-3">
        <MobileFilterTrigger
          label="Category"
          value={categoryLabel}
          onClick={() => setSheet('category')}
        />
        {brands.length ? (
          <MobileFilterTrigger label="Brand" value={brandLabel} onClick={() => setSheet('brand')} />
        ) : (
          <MobileFilterTrigger label="Sort by" value={sortLabel} onClick={() => setSheet('sort')} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MobileFilterTrigger label="Price" value={priceLabel} onClick={() => setSheet('price')} />
        {brands.length ? (
          <MobileFilterTrigger label="Sort by" value={sortLabel} onClick={() => setSheet('sort')} />
        ) : null}
      </div>

      <button
        type="button"
        disabled={!hasFilters}
        onClick={() => {
          setSheet(null)
          router.push('/catalogue')
        }}
        className={`inline-flex min-h-10 w-full items-center text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${
          hasFilters ? 'text-[#806A50]' : 'cursor-not-allowed text-[#C4BDB3]'
        }`}
      >
        Clear all filters
      </button>

      <MobileFilterSheetShell
        open={Boolean(sheet)}
        title={
          sheet === 'category'
            ? 'Category'
            : sheet === 'brand'
              ? 'Brand'
              : sheet === 'price'
                ? 'Price'
                : 'Sort by'
        }
        onClose={() => setSheet(null)}
      >
        {sheet === 'category' ? (
          <>
            <MobileFilterSheetOption
              label="All gifts"
              meta={`${productTotal}`}
              active={!categoryFilter}
              onSelect={() => go({ category: '' })}
            />
            {categories.map((item) => (
              <MobileFilterSheetOption
                key={item.id}
                label={item.name}
                meta={`${categoryCounts[item.id] || 0}`}
                active={categoryFilter === item.id}
                onSelect={() => go({ category: item.id })}
              />
            ))}
          </>
        ) : null}

        {sheet === 'brand' ? (
          <>
            <MobileFilterSheetOption
              label="All brands"
              active={!brandFilter}
              onSelect={() => go({ brand: '' })}
            />
            {brands.map((item) => (
              <MobileFilterSheetOption
                key={item.id}
                label={item.name}
                meta={`${brandCounts[item.id] || 0}`}
                active={brandFilter === item.id}
                onSelect={() => go({ brand: item.id })}
              />
            ))}
          </>
        ) : null}

        {sheet === 'price' ? (
          <div className="px-2 py-3">
            <PriceRangeFilter
              key={`${priceMin}-${priceMax}`}
              bounds={priceBounds}
              value={{ min: priceMin, max: priceMax }}
              basePath="/catalogue"
              preserveParams={{
                q: search,
                category: categoryFilter,
                brand: brandFilter,
                sort: sort !== 'name' ? sort : '',
              }}
            />
          </div>
        ) : null}

        {sheet === 'sort'
          ? SORT_OPTIONS.map((item) => (
              <MobileFilterSheetOption
                key={item.value}
                label={item.label}
                active={sort === item.value}
                onSelect={() => go({ sort: item.value })}
              />
            ))
          : null}
      </MobileFilterSheetShell>
    </div>
  )
}
