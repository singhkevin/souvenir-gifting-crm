'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MobileFilterSheetOption,
  MobileFilterSheetShell,
  MobileFilterTrigger,
} from '@/components/ui/mobile-filter-sheet'

type CategoryOption = { id: string; name: string }
type BudgetOption = { id: string; label: string }

const SORT_OPTIONS = [
  { value: 'name', label: 'A–Z' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
] as const

export function MobileCatalogueFilters({
  categories,
  categoryFilter,
  budget,
  budgetChips,
  search,
  sort,
  categoryCounts,
  productTotal,
}: {
  categories: CategoryOption[]
  categoryFilter: string
  budget: string
  budgetChips: BudgetOption[]
  search: string
  sort: string
  categoryCounts: Record<string, number>
  productTotal: number
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState<'category' | 'budget' | 'sort' | null>(null)

  const go = (overrides: { category?: string; budget?: string; sort?: string }) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const nextCategory = overrides.category !== undefined ? overrides.category : categoryFilter
    const nextBudget = overrides.budget !== undefined ? overrides.budget : budget
    const nextSort = overrides.sort !== undefined ? overrides.sort : sort
    if (nextCategory) params.set('category', nextCategory)
    if (nextBudget) params.set('budget', nextBudget)
    if (nextSort && nextSort !== 'name') params.set('sort', nextSort)
    const qs = params.toString()
    setSheet(null)
    router.push(`/catalogue${qs ? `?${qs}` : ''}`)
  }

  const categoryLabel =
    categories.find((item) => item.id === categoryFilter)?.name || 'All gifts'
  const budgetLabel = budgetChips.find((item) => item.id === budget)?.label || 'Any budget'
  const sortLabel = SORT_OPTIONS.find((item) => item.value === sort)?.label || 'A–Z'

  const hasFilters = Boolean(search || categoryFilter || budget || (sort && sort !== 'name'))

  return (
    <div className="mt-5 space-y-3 lg:hidden">
      <div className="grid grid-cols-2 gap-3">
        <MobileFilterTrigger
          label="Category"
          value={categoryLabel}
          onClick={() => setSheet('category')}
        />
        <MobileFilterTrigger
          label="Budget"
          value={budgetLabel}
          onClick={() => setSheet('budget')}
        />
      </div>
      <MobileFilterTrigger label="Sort by" value={sortLabel} onClick={() => setSheet('sort')} />

      <button
        type="button"
        disabled={!hasFilters}
        onClick={() => {
          setSheet(null)
          router.push('/catalogue')
        }}
        className={`inline-flex min-h-10 w-full items-center text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${
          hasFilters ? 'text-[#1A3022]' : 'cursor-not-allowed text-[#C4BDB3]'
        }`}
      >
        Clear all filters
      </button>

      <MobileFilterSheetShell
        open={Boolean(sheet)}
        title={
          sheet === 'category' ? 'Category' : sheet === 'budget' ? 'Shop by price' : 'Sort by'
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

        {sheet === 'budget'
          ? budgetChips.map((item) => (
              <MobileFilterSheetOption
                key={item.id || 'any'}
                label={item.label}
                active={budget === item.id}
                onSelect={() => go({ budget: item.id })}
              />
            ))
          : null}

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
