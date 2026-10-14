'use client'

import { useMemo, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

export type PickerProduct = {
  id: string
  name: string
  sku: string
  imageUrl: string | null
  category: string | null
  price: number
  moq: number
}

type Selection = { selected: boolean; quantity: string }

export function ProductPickerDrawer({
  products,
  title = 'Add products',
  description = 'Search, filter, and choose the products and quantities.',
  submitLabel = 'Add selected',
  showQuantity = true,
  variant = 'drawer',
  onSubmit,
}: {
  products: PickerProduct[]
  title?: string
  description?: string
  submitLabel?: string
  showQuantity?: boolean
  /** Drawer for the quotation editor. Panel is the catalog product grid. */
  variant?: 'drawer' | 'panel'
  onSubmit: (rows: { id: string; quantity: number }[]) => Promise<unknown>
}) {
  const { pending, error, run } = useAction()
  const [open, setOpen] = useState(variant === 'panel')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [rows, setRows] = useState<Record<string, Selection>>({})

  const categories = useMemo(() => {
    return [...new Set(products.map((product) => product.category).filter(Boolean) as string[])].sort()
  }, [products])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const min = minPrice.trim() === '' ? null : Number(minPrice)
    const max = maxPrice.trim() === '' ? null : Number(maxPrice)
    return products.filter((product) => {
      if (category && product.category !== category) return false
      if (min != null && Number.isFinite(min) && product.price < min) return false
      if (max != null && Number.isFinite(max) && product.price > max) return false
      if (!needle) return true
      return product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)
    })
  }, [products, query, category, minPrice, maxPrice])

  const selectedCount = Object.values(rows).filter((row) => row.selected).length

  function toggle(product: PickerProduct) {
    setRows((current) => {
      const existing = current[product.id]
      return {
        ...current,
        [product.id]: {
          selected: !existing?.selected,
          quantity: existing?.quantity || String(product.moq || 1),
        },
      }
    })
  }

  function setQuantity(id: string, quantity: string) {
    setRows((current) => ({
      ...current,
      [id]: { selected: current[id]?.selected ?? true, quantity },
    }))
  }

  const body = (
          <div className={variant === 'drawer' ? 'flex h-full w-full max-w-3xl flex-col bg-[#FAF7F2] shadow-xl' : 'overflow-hidden rounded-2xl border border-[#E5DFD5] bg-[#FAF7F2]'} role={variant === 'drawer' ? 'dialog' : 'region'} aria-modal={variant === 'drawer' ? true : undefined} aria-labelledby="product-picker-title">
            <div className="flex items-start justify-between gap-3 border-b border-[#E5DFD5] bg-white px-4 py-4">
              <div>
                <h2 id="product-picker-title" className="font-serif text-xl text-[#1C1917]">{title}</h2>
                <p className="mt-1 text-xs text-[#5A5248]">{description}</p>
              </div>
              {variant === 'drawer' ? (
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">
                  Close
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 border-b border-[#E5DFD5] bg-white px-4 py-3 sm:grid-cols-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name or SKU"
                className="min-h-10 rounded-lg border px-3 text-xs sm:col-span-2"
              />
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 rounded-lg border px-2 text-xs">
                <option value="">All categories</option>
                {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <div className="flex gap-2">
                <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} inputMode="decimal" placeholder="Min price" className="min-h-10 w-full rounded-lg border px-2 text-xs" />
                <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} inputMode="decimal" placeholder="Max price" className="min-h-10 w-full rounded-lg border px-2 text-xs" />
              </div>
            </div>
            <div className={variant === 'drawer' ? 'flex-1 overflow-y-auto p-4' : 'max-h-[32rem] overflow-y-auto p-4'}>
              <p className="mb-3 text-xs text-[#7A7267]">{filtered.length} products · {selectedCount} selected</p>
              {filtered.length === 0 ? <p className="text-sm text-[#7A7267]">No products match these filters.</p> : null}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((product) => {
                  const row = rows[product.id]
                  const selected = Boolean(row?.selected)
                  return (
                    <article key={product.id} className={`flex gap-3 rounded-xl border bg-white p-3 ${selected ? 'border-[#806A50]' : 'border-[#E5DFD5]'}`}>
                      <ProductImage src={product.imageUrl} alt={product.name} size="sm" className="shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1C1917]">{product.name}</p>
                        <p className="font-mono text-[10px] text-[#7A7267]">{product.sku}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {product.category ? <span className="rounded-full bg-[#F4EFE6] px-2 py-0.5 text-[10px] font-semibold text-[#624B32]">{product.category}</span> : null}
                          <span className="text-xs font-semibold">{formatCurrency(product.price)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 text-xs">
                            <input type="checkbox" checked={selected} onChange={() => toggle(product)} />
                            Select
                          </label>
                          {showQuantity && selected ? (
                            <label className="inline-flex items-center gap-1 text-xs">
                              Qty
                              <input
                                type="number"
                                min="1"
                                value={row?.quantity || '1'}
                                onChange={(event) => setQuantity(product.id, event.target.value)}
                                className="w-16 rounded border px-1.5 py-1"
                              />
                            </label>
                          ) : null}
                          <a href={`/crm/products/${product.id}`} className="text-xs font-semibold text-[#624B32] underline">Open</a>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
            <div className="border-t border-[#E5DFD5] bg-white px-4 py-3">
              {error ? <p className="mb-2 text-xs text-red-700" role="alert">{error}</p> : null}
              <button
                type="button"
                disabled={pending || selectedCount === 0}
                onClick={() => {
                  const chosen = products
                    .filter((product) => rows[product.id]?.selected)
                    .map((product) => ({
                      id: product.id,
                      quantity: Math.max(1, Math.round(Number(rows[product.id]?.quantity) || product.moq || 1)),
                    }))
                  run(() => onSubmit(chosen), {
                    successMessage: 'Products added',
                    onSuccess: () => {
                      setRows({})
                      if (variant === 'drawer') setOpen(false)
                    },
                  })
                }}
                className="min-h-11 rounded-lg bg-[#806A50] px-4 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? <span className="inline-flex items-center gap-2"><Spinner />Adding…</span> : `${submitLabel} (${selectedCount})`}
              </button>
            </div>
          </div>
  )

  if (variant === 'panel') return body

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] px-4 text-xs font-semibold text-white"
      >
        {title}
      </button>
      {open ? <div className="fixed inset-0 z-50 flex justify-end bg-black/40">{body}</div> : null}
    </>
  )
}
