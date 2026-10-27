'use client'

import { startTransition, useEffect, useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { addProductToRequirement, searchRequirementProducts } from '../actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { isUuid } from '@/lib/utils'
import { pickerStatus, REQUIREMENT_PICKER_LIMIT } from '@/lib/requirements/product-search'

type Hit = { id: string; name: string; sku: string | null }

export function RequirementProductPicker({
  requirementId,
  defaultQuantity,
  excludeIds,
}: {
  requirementId: string
  defaultQuantity: number
  excludeIds: string[]
}) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Hit[]>([])
  const [truncated, setTruncated] = useState(false)
  const [searching, setSearching] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Hit | null>(null)
  const excludeKey = excludeIds.filter((id) => isUuid(id)).join(',')

  useEffect(() => {
    let cancelled = false
    const handle = window.setTimeout(() => {
      const ids = excludeKey ? excludeKey.split(',') : []
      setSearching(true)
      startTransition(() => {
        void searchRequirementProducts(query, ids)
          .then((result) => {
            if (cancelled) return
            setSearching(false)
            if ('error' in result && result.error) {
              setLoadError(result.error)
              setResults([])
              setTruncated(false)
              return
            }
            setLoadError(null)
            setResults(result.products || [])
            setTruncated(Boolean(result.truncated))
          })
          .catch(() => {
            if (cancelled) return
            setSearching(false)
            setLoadError('Could not search products. Try again.')
            setResults([])
            setTruncated(false)
          })
      })
    }, query.trim() ? 200 : 0)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query, excludeKey])

  const status = pickerStatus({
    searching,
    query,
    count: results.length,
    truncated,
    limit: REQUIREMENT_PICKER_LIMIT,
  })

  return (
    <div className="space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
          Search products
        </span>
        <input
          type="search"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name or SKU"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
        />
      </label>

      <p className="text-[11px] text-[#7C766F]">{status}</p>
      {loadError ? (
        <div className="border border-[#BA1A1A]/40 bg-[#FBEDEB] px-3 py-2 text-xs text-[#BA1A1A]" role="alert">
          {loadError}
        </div>
      ) : null}

      <ul
        id={listId}
        role="listbox"
        aria-label="Matching products"
        className={results.length > 0 ? 'max-h-64 overflow-y-auto border border-[#CCC5BD] bg-[#FCF9F2]' : 'hidden'}
      >
          {results.map((product) => {
            const active = selected?.id === product.id
            return (
              <li key={product.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => setSelected(product)}
                  className={`flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left text-xs ${
                    active ? 'bg-[#FFB690]/30 text-[#1C1B1A]' : 'text-[#1C1B1A] hover:bg-[#F6F3EC]'
                  }`}
                >
                  <span className="min-w-0 truncate font-semibold">{product.name}</span>
                  {product.sku ? <span className="shrink-0 font-mono text-[11px] text-[#7C766F]">{product.sku}</span> : null}
                </button>
              </li>
            )
          })}
      </ul>

      <p className="text-xs text-[#4A4640]">
        {selected ? (
          <>
            Selected · <span className="font-semibold text-[#1C1B1A]">{selected.name}</span>
            {selected.sku ? <span className="font-mono text-[#7C766F]"> · {selected.sku}</span> : null}
          </>
        ) : (
          'Select a product, then add it to this brief.'
        )}
      </p>

      <ActionForm action={addProductToRequirement} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="requirement_id" value={requirementId} />
        <input type="hidden" name="product_id" value={selected?.id || ''} />
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
      </ActionForm>
    </div>
  )
}
