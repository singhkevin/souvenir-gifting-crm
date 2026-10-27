'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { PRODUCT_SEARCH_LIMIT, PRODUCT_SEARCH_MIN, type SearchableProduct } from '@/lib/requirements/product-search'
import { addProductToRequirement, searchRequirementProducts } from '../actions'

export function RequirementProductPicker({
  requirementId,
  defaultQuantity,
}: {
  requirementId: string
  defaultQuantity: number
}) {
  const [query, setQuery] = useState('')
  const [payload, setPayload] = useState<{
    term: string
    products: SearchableProduct[]
    truncated: boolean
    error: string | null
  } | null>(null)
  const [selected, setSelected] = useState<SearchableProduct | null>(null)
  const [revision, setRevision] = useState(0)
  const term = query.trim()

  useEffect(() => {
    if (term.length < PRODUCT_SEARCH_MIN) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void searchRequirementProducts(requirementId, term)
        .then((result) => {
          if (cancelled) return
          if ('error' in result && result.error) {
            setPayload({ term, products: [], truncated: false, error: result.error })
            return
          }
          setPayload({ term, products: result.products, truncated: result.truncated, error: null })
        })
        .catch(() => {
          if (cancelled) return
          setPayload({ term, products: [], truncated: false, error: 'Search failed. Try again.' })
        })
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [term, requirementId, revision])

  const active = payload?.term === term ? payload : null
  const results = active?.products ?? []
  const truncated = Boolean(active?.truncated)
  const searchError = active?.error ?? null
  const waiting = term.length >= PRODUCT_SEARCH_MIN && !active
  const status =
    searchError ||
    (waiting ? 'Searching…' : null) ||
    (term.length > 0 && term.length < PRODUCT_SEARCH_MIN ? 'Type at least 2 characters.' : null) ||
    (term.length >= PRODUCT_SEARCH_MIN && results.length === 0 ? 'No products match that search.' : null) ||
    (truncated
      ? `Showing the first ${PRODUCT_SEARCH_LIMIT} matches · refine the search.`
      : results.length > 0
        ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}`
        : null)

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
          Product
        </span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or SKU"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
      </label>
      {status ? (
        <p className={`text-xs ${searchError ? 'text-[#BA1A1A]' : 'text-[#7C766F]'}`} aria-live="polite">
          {status}
        </p>
      ) : null}
      {results.length > 0 ? (
        <ul className="max-h-60 overflow-y-auto border border-[#CCC5BD] bg-white">
          {results.map((product) => {
            const active = selected?.id === product.id
            return (
              <li key={product.id} className="border-b border-[#CCC5BD] last:border-b-0">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(product)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-xs ${
                    active ? 'bg-[#FFB690]/30 text-[#1C1B1A]' : 'text-[#1C1B1A] hover:bg-[#F6F3EC]'
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">{product.name}</span>
                  {product.sku ? (
                    <span className="shrink-0 font-mono text-[11px] text-[#7C766F]">{product.sku}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      {selected ? (
        <p className="text-xs text-[#1C1B1A]">
          Selected · {selected.name}
          {selected.sku ? ` · ${selected.sku}` : ''}
        </p>
      ) : results.length > 0 ? (
        <p className="text-xs text-[#7C766F]">Select a product, then add it.</p>
      ) : null}
      <ActionForm
        action={addProductToRequirement}
        successMessage="Product added"
        onSuccess={() => {
          setSelected(null)
          setPayload(null)
          setRevision((current) => current + 1)
        }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="requirement_id" value={requirementId} />
        <input type="hidden" name="product_id" value={selected?.id || ''} />
        <label className="block w-full sm:w-28">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            Qty
          </span>
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={defaultQuantity || 1}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <SubmitButton
          disabled={!selected}
          className="inline-flex min-h-10 items-center justify-center gap-1 rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
          pendingLabel="Adding…"
        >
          <Plus size={14} /> Add product
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
