'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addCatalogProducts } from './actions'
import { formatCurrency } from '@/lib/utils'
import type { CatalogPickerProduct } from '@/lib/catalogs/picker-products'

export function CatalogProductPicker({
  catalogId,
  products,
}: {
  catalogId: string
  products: CatalogPickerProduct[]
}) {
  const bounds = useMemo(() => {
    const maxPrice = Math.max(0, ...products.map((product) => product.sellPrice || 0))
    const max = Math.max(100, Math.ceil(maxPrice / 100) * 100)
    return { min: 0, max }
  }, [products])
  const [range, setRange] = useState(bounds)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      if (product.sellPrice < range.min || product.sellPrice > range.max) return false
      if (!needle) return true
      return product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)
    })
  }, [products, query, range])

  const span = Math.max(bounds.max - bounds.min, 1)
  const leftPct = ((range.min - bounds.min) / span) * 100
  const rightPct = ((range.max - bounds.min) / span) * 100
  const step = Math.max(1, Math.round(span / 100))

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectVisible = () => {
    setSelected((current) => {
      const next = new Set(current)
      filtered.forEach((product) => next.add(product.id))
      return next
    })
  }

  const submit = () => {
    const ids = [...selected]
    if (!ids.length) {
      toast.error('Select at least one product')
      return
    }
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    ids.forEach((id) => formData.append('product_id', id))
    startTransition(async () => {
      const result = await addCatalogProducts(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        result.skipped
          ? `Added ${result.added}. Skipped ${result.skipped} already on the catalog or inactive.`
          : `Added ${result.added} product${result.added === 1 ? '' : 's'} as drafts.`,
      )
      window.location.reload()
    })
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-4 text-xs">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Add products</h2>
        <p className="mt-1 text-[#7A7267]">
          Filter by client sell price, then select several products. Prices use the pricing company&apos;s B2B margin when one is assigned.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or SKU"
            className="min-h-11 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <div>
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">
            <span>Client sell price</span>
            <span className="normal-case tracking-normal">{formatCurrency(range.min)} – {formatCurrency(range.max)}</span>
          </div>
          <div className="relative mt-3 h-5">
            <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#E8E4DE]" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#806A50]"
              style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
            />
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              step={step}
              value={range.min}
              onChange={(event) => {
                const next = Math.min(Number(event.target.value), range.max - step)
                setRange({ min: next, max: range.max })
              }}
              className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
              aria-label="Minimum client sell price"
            />
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              step={step}
              value={range.max}
              onChange={(event) => {
                const next = Math.max(Number(event.target.value), range.min + step)
                setRange({ min: range.min, max: next })
              }}
              className="range-thumb pointer-events-none absolute inset-x-0 top-1/2 h-5 w-full -translate-y-1/2 appearance-none bg-transparent"
              aria-label="Maximum client sell price"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[#7A7267]">{filtered.length} products · {selected.size} selected</p>
        <div className="flex gap-2">
          <button type="button" onClick={selectVisible} className="underline text-[#806A50]">Select visible</button>
          <button type="button" onClick={() => setSelected(new Set())} className="underline">Clear</button>
        </div>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[#E5DFD5] p-2">
        {filtered.length === 0 && <p className="p-3 text-[#7A7267]">No active products in this price range.</p>}
        {filtered.map((product) => (
          <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#FAF7F2]">
            <input
              type="checkbox"
              checked={selected.has(product.id)}
              onChange={() => toggle(product.id)}
              className="h-4 w-4"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-[#1C1917]">{product.name}</span>
              <span className="text-[#7A7267]">{product.sku}</span>
            </span>
            <span className="shrink-0 font-semibold">{formatCurrency(product.sellPrice)}</span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={pending || selected.size === 0}
        onClick={submit}
        className="min-h-11 rounded-lg bg-[#806A50] px-4 font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Adding…' : `Add ${selected.size || ''} as draft offerings`.replace('  ', ' ')}
      </button>
    </div>
  )
}
