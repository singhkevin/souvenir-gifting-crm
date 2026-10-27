'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { addProductToRequirement, searchRequirementProducts } from '@/app/crm/requirements/actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

type Hit = { id: string; name: string; sku: string | null }

export function RequirementProductPicker({
  requirementId,
  defaultQuantity,
}: {
  requirementId: string
  defaultQuantity: number
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [truncated, setTruncated] = useState(false)
  const [searching, setSearching] = useState(true)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Hit | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const current = ++requestId.current
    let cancelled = false
    const handle = window.setTimeout(async () => {
      const result = await searchRequirementProducts(requirementId, query)
      if (cancelled || current !== requestId.current) return
      setSearching(false)
      if ('error' in result) {
        setSearchError(result.error || 'Could not search products')
        setHits([])
        setTruncated(false)
        return
      }
      setSearchError(null)
      setHits(result.products)
      setTruncated(result.truncated)
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [requirementId, query])

  const hint = searchError
    ? null
    : searching
      ? 'Searching…'
      : hits.length === 0
        ? query.trim()
          ? 'No matching products left to add.'
          : 'No active products left to add.'
        : truncated
          ? query.trim()
            ? 'More products match · keep typing to narrow the list.'
            : 'Showing the first matches · search by name or SKU for the rest.'
          : `${hits.length} product${hits.length === 1 ? '' : 's'}`

  return (
    <ActionForm action={addProductToRequirement} className="flex flex-col gap-3">
      <input type="hidden" name="requirement_id" value={requirementId} />
      <input type="hidden" name="product_id" value={selected?.id || ''} />
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
          Product
        </span>
        <input
          type="search"
          value={query}
          autoFocus
          placeholder="Search name or SKU"
          onChange={(event) => {
            setQuery(event.target.value)
            setSearching(true)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault()
          }}
          className="min-h-10 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
      </label>

      <div className="max-h-60 overflow-y-auto rounded-none border border-[#CCC5BD] bg-white" role="listbox" aria-label="Matching products">
        {hits.map((product) => {
          const active = selected?.id === product.id
          return (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => setSelected(product)}
              className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-xs ${
                active ? 'bg-[#FFB690]/40 text-[#1C1B1A]' : 'text-[#1C1B1A] hover:bg-[#F6F3EC]'
              }`}
            >
              <span className="min-w-0 truncate font-semibold">{product.name}</span>
              {product.sku ? <span className="shrink-0 font-mono text-[11px] text-[#7C766F]">{product.sku}</span> : null}
            </button>
          )
        })}
        {!searching && hits.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-[#7C766F]">No products to show.</p>
        ) : null}
      </div>

      {searchError ? (
        <p className="text-xs text-[#BA1A1A]" role="alert">
          {searchError}
        </p>
      ) : hint ? (
        <p className="text-xs text-[#7C766F]">{hint}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <p className="min-w-0 flex-1 text-xs text-[#1C1B1A]">
          {selected
            ? `Selected · ${selected.name}${selected.sku ? ` · ${selected.sku}` : ''}`
            : 'Select a product from the list.'}
        </p>
        <label className="block w-full sm:w-28">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Qty</span>
          <input
            name="quantity"
            type="number"
            min="1"
            defaultValue={defaultQuantity > 0 ? defaultQuantity : 1}
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
      </div>
    </ActionForm>
  )
}
