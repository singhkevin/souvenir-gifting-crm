'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, X } from 'lucide-react'
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

function SV2MobileFilterTrigger({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string
  value: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full border border-[#CCC5BD] bg-[#FCF9F2] px-3.5 py-3 text-left transition-colors hover:border-[#1C1B1A] ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      }`}
    >
      <span className="block font-sans text-xs font-semibold uppercase tracking-wider text-[#7C766F]">
        {label}
      </span>
      <span className="mt-1 flex items-center justify-between gap-2 text-sm text-[#1C1B1A]">
        <span className="min-w-0 truncate">{value}</span>
        <ChevronDown size={14} className="shrink-0 text-[#9E4300]" />
      </span>
    </button>
  )
}

function SV2MobileFilterSheetOption({
  label,
  meta,
  active,
  onSelect,
}: {
  label: string
  meta?: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors border-b border-[#CCC5BD] last:border-b-0 ${
        active ? 'bg-[#1C1B1A] text-[#FCF9F2]' : 'text-[#1C1B1A] hover:bg-[#F6F3EC]'
      }`}
    >
      <span className="min-w-0 truncate text-sm">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {meta ? (
          <span className={`font-mono text-xs ${active ? 'text-[#FCF9F2]/70' : 'text-[#7C766F]'}`}>
            {meta}
          </span>
        ) : null}
        {active ? <Check size={14} className="text-[#FCF9F2]" /> : null}
      </span>
    </button>
  )
}

function SV2MobileFilterSheetShell({
  open,
  title,
  eyebrow = 'Filter',
  onClose,
  children,
  footer,
}: {
  open: boolean
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close filters"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[85vh] overflow-hidden border-t border-[#CCC5BD] bg-[#FCF9F2]"
      >
        <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#7C766F]">
                {eyebrow}
              </p>
              <h2 id={titleId} className="mt-0.5 font-serif text-xl text-[#1C1B1A]">
                {title}
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1B1A] transition-colors hover:bg-[#E5E2DB]"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="max-h-[min(58vh,28rem)] overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin]">
          {children}
        </div>
        {footer ? <div className="border-t border-[#CCC5BD] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}

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
        <SV2MobileFilterTrigger
          label="Category"
          value={categoryLabel}
          onClick={() => setSheet('category')}
        />
        {brands.length ? (
          <SV2MobileFilterTrigger label="Brand" value={brandLabel} onClick={() => setSheet('brand')} />
        ) : (
          <SV2MobileFilterTrigger label="Sort by" value={sortLabel} onClick={() => setSheet('sort')} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SV2MobileFilterTrigger label="Price" value={priceLabel} onClick={() => setSheet('price')} />
        {brands.length ? (
          <SV2MobileFilterTrigger label="Sort by" value={sortLabel} onClick={() => setSheet('sort')} />
        ) : null}
      </div>

      <button
        type="button"
        disabled={!hasFilters}
        onClick={() => {
          setSheet(null)
          router.push('/catalogue')
        }}
        className={`inline-flex min-h-10 w-full items-center font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
          hasFilters ? 'text-[#9E4300] hover:underline' : 'cursor-not-allowed text-[#CCC5BD]'
        }`}
      >
        Clear all filters
      </button>

      <SV2MobileFilterSheetShell
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
            <SV2MobileFilterSheetOption
              label="All gifts"
              meta={`${productTotal}`}
              active={!categoryFilter}
              onSelect={() => go({ category: '' })}
            />
            {categories.map((item) => (
              <SV2MobileFilterSheetOption
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
            <SV2MobileFilterSheetOption
              label="All brands"
              active={!brandFilter}
              onSelect={() => go({ brand: '' })}
            />
            {brands.map((item) => (
              <SV2MobileFilterSheetOption
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
              <SV2MobileFilterSheetOption
                key={item.value}
                label={item.label}
                active={sort === item.value}
                onSelect={() => go({ sort: item.value })}
              />
            ))
          : null}
      </SV2MobileFilterSheetShell>
    </div>
  )
}
