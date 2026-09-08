'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, X } from 'lucide-react'

type CategoryOption = { id: string; name: string }
type BudgetOption = { id: string; label: string }

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
  const titleId = useId()
  const [sheet, setSheet] = useState<'category' | 'budget' | null>(null)

  useEffect(() => {
    if (!sheet) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSheet(null)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [sheet])

  const go = (overrides: { category?: string; budget?: string }) => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const nextCategory = overrides.category !== undefined ? overrides.category : categoryFilter
    const nextBudget = overrides.budget !== undefined ? overrides.budget : budget
    if (nextCategory) params.set('category', nextCategory)
    if (nextBudget) params.set('budget', nextBudget)
    if (sort && sort !== 'name') params.set('sort', sort)
    const qs = params.toString()
    setSheet(null)
    router.push(`/catalogue${qs ? `?${qs}` : ''}`)
  }

  const categoryLabel =
    categories.find((item) => item.id === categoryFilter)?.name || 'All gifts'
  const budgetLabel = budgetChips.find((item) => item.id === budget)?.label || 'Any budget'

  return (
    <div className="mt-5 lg:hidden">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSheet('category')}
          className="rounded-md border border-[#E8E4DE] bg-[#F6F4F1] px-3.5 py-3 text-left"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">
            Category
          </span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-[15px] text-[#1B2430]">
            <span className="truncate">{categoryLabel}</span>
            <ChevronDown size={16} className="shrink-0 text-[#1A3022]" />
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSheet('budget')}
          className="rounded-md border border-[#E8E4DE] bg-[#F6F4F1] px-3.5 py-3 text-left"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">
            Budget
          </span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-[15px] text-[#1B2430]">
            <span className="truncate">{budgetLabel}</span>
            <ChevronDown size={16} className="shrink-0 text-[#1A3022]" />
          </span>
        </button>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-[#1A3022]/45"
            onClick={() => setSheet(null)}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-10 max-h-[78vh] overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(27,36,48,0.18)]"
          >
            <div className="border-b border-[#E8E4DE] px-4 pb-3 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D6CEBE]" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8A929C]">
                    Filter
                  </p>
                  <h2 id={titleId} className="mt-1 font-serif text-2xl text-[#1B2430]">
                    {sheet === 'category' ? 'Category' : 'Shop by price'}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setSheet(null)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F4F1] text-[#1A3022]"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="max-h-[min(58vh,28rem)] overflow-y-auto overscroll-contain px-2 py-2 [scrollbar-width:thin]">
              {sheet === 'category' ? (
                <>
                  <SheetOption
                    label="All gifts"
                    meta={`${productTotal}`}
                    active={!categoryFilter}
                    onSelect={() => go({ category: '' })}
                  />
                  {categories.map((item) => (
                    <SheetOption
                      key={item.id}
                      label={item.name}
                      meta={`${categoryCounts[item.id] || 0}`}
                      active={categoryFilter === item.id}
                      onSelect={() => go({ category: item.id })}
                    />
                  ))}
                </>
              ) : (
                budgetChips.map((item) => (
                  <SheetOption
                    key={item.id || 'any'}
                    label={item.label}
                    active={budget === item.id}
                    onSelect={() => go({ budget: item.id })}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SheetOption({
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
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3.5 text-left transition-colors ${
        active ? 'bg-[#1A3022] text-white' : 'text-[#1B2430] hover:bg-[#F6F4F1]'
      }`}
    >
      <span className="min-w-0 truncate text-[15px]">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        {meta ? (
          <span className={`text-xs ${active ? 'text-white/70' : 'text-[#8A929C]'}`}>{meta}</span>
        ) : null}
        {active ? <Check size={16} className="text-white" /> : null}
      </span>
    </button>
  )
}
