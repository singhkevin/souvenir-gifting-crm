'use client'

import { useMemo, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { cleanSpecs, parseMoq, parseMoney } from '@/lib/presentations/rules'
import { ProductThumb } from '@/components/ui/product-thumb'

export type DeckProduct = {
  id: string
  name: string
  sku: string
  image_url: string | null
  description: string | null
  price: number
  moq: number
}

type Slide = {
  key: string
  kind: 'product' | 'combo'
  productId: string | null
  productIds: string[]
  title: string
  imageUrl: string | null
  specs: string
  price: string
  moq: string
  memberNames: string[]
}

export function DeckEditor({
  products,
  companies,
  initial,
}: {
  products: DeckProduct[]
  companies: { id: string; name: string }[]
  initial?: {
    title: string
    clientName: string
    notes: string
    companyId: string
    showPrices?: boolean
    slides: Slide[]
  }
}) {
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [comboName, setComboName] = useState('')
  const [comboPrice, setComboPrice] = useState('')
  const [slides, setSlides] = useState<Slide[]>(initial?.slides || [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = needle
      ? products.filter((product) => product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle))
      : products
    return rows.slice(0, 24)
  }, [products, query])

  const payload = slides.map((slide) => ({
    kind: slide.kind,
    productId: slide.productId,
    productIds: slide.productIds,
    title: slide.title,
    specs: slide.specs,
    price: parseMoney(slide.price),
    moq: parseMoq(slide.moq),
  }))

  function addProduct(product: DeckProduct) {
    if (slides.some((slide) => slide.kind === 'product' && slide.productId === product.id)) return
    setSlides((current) => [
      ...current,
      {
        key: `product-${product.id}`,
        kind: 'product',
        productId: product.id,
        productIds: [],
        title: product.name,
        imageUrl: product.image_url,
        specs: cleanSpecs(product.description || ''),
        price: String(product.price || 0),
        moq: String(product.moq || 1),
        memberNames: [],
      },
    ])
  }

  function addCombo() {
    const members = products.filter((product) => checked.includes(product.id))
    if (members.length < 2 || !comboName.trim() || parseMoney(comboPrice) == null) return
    const moq = Math.max(...members.map((product) => product.moq || 1))
    setSlides((current) => [
      ...current,
      {
        key: `combo-${Date.now()}`,
        kind: 'combo',
        productId: null,
        productIds: members.map((product) => product.id),
        title: comboName.trim(),
        imageUrl: members[0]?.image_url || null,
        specs: cleanSpecs(members.map((product) => product.name).join(', ')),
        price: comboPrice,
        moq: String(moq),
        memberNames: members.map((product) => product.name),
      },
    ])
    setChecked([])
    setComboName('')
    setComboPrice('')
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="items_json" value={JSON.stringify(payload)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gray-500">
          Title
          <input name="title" required defaultValue={initial?.title || ''} className="mt-1 w-full border px-3 py-2 text-sm" />
        </label>
        <label className="block text-xs text-gray-500">
          Client name
          <input name="client_name" required defaultValue={initial?.clientName || ''} className="mt-1 w-full border px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="block text-xs text-gray-500">
        Notes
        <textarea name="notes" defaultValue={initial?.notes || ''} rows={2} className="mt-1 w-full border px-3 py-2 text-sm" />
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="block text-xs text-gray-500">
          Company prices
          <select name="company_id" defaultValue={initial?.companyId || ''} className="mt-1 w-full border px-3 py-2 text-sm">
            <option value="">Custom prices only</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="use_company_prices" />
          Fill product prices from this company
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="show_prices" defaultChecked={initial?.showPrices ?? true} />
          Show prices on the share link and PDF
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
        <div>
          <label className="block text-xs text-gray-500">
            Products
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="mt-1 w-full border px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {visible.map((product) => {
              const on = checked.includes(product.id)
              return (
                <div key={product.id} className="border bg-white p-2">
                  <div className="aspect-square overflow-hidden bg-[#F6F4F1]">
                    <ProductImage src={product.image_url} alt={product.name} size="md" fit="contain" className="h-full w-full bg-transparent" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium">{product.name}</p>
                  <p className="text-[11px] text-gray-500">{product.sku}</p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => addProduct(product)} className="bg-[#241C12] px-2 py-1 text-[11px] font-semibold text-white">Add</button>
                    <button
                      type="button"
                      onClick={() => setChecked((current) => current.includes(product.id) ? current.filter((id) => id !== product.id) : [...current, product.id])}
                      className={`border px-2 py-1 text-[11px] ${on ? 'border-[#806A50] text-[#806A50]' : ''}`}
                    >
                      {on ? 'In combo' : 'Combo'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="block text-xs text-gray-500">
              Combo name
              <input value={comboName} onChange={(event) => setComboName(event.target.value)} className="mt-1 border px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs text-gray-500">
              Combined price
              <input value={comboPrice} onChange={(event) => setComboPrice(event.target.value)} inputMode="decimal" className="mt-1 w-28 border px-3 py-2 text-sm" />
            </label>
            <button type="button" disabled={checked.length < 2 || !comboName.trim() || parseMoney(comboPrice) == null} onClick={addCombo} className="border px-3 py-2 text-sm disabled:opacity-40">
              Add combo ({checked.length})
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Slides</p>
          {slides.length === 0 ? <p className="text-sm text-gray-500">Nothing on the deck yet.</p> : null}
          {slides.map((slide) => (
            <div key={slide.key} className="border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <ProductThumb src={slide.imageUrl} alt={slide.title} />
                  <p className="text-sm font-medium">{slide.title}</p>
                </div>
                <button type="button" className="text-xs text-red-700" onClick={() => setSlides((current) => current.filter((row) => row.key !== slide.key))}>Remove</button>
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-500">{slide.kind}</p>
              {slide.memberNames.length ? <p className="mt-1 text-xs text-gray-500">{slide.memberNames.join(', ')}</p> : null}
              <label className="mt-2 block text-xs text-gray-500">
                Specs
                <textarea
                  value={slide.specs}
                  rows={2}
                  onChange={(event) => setSlides((current) => current.map((row) => row.key === slide.key ? { ...row, specs: event.target.value } : row))}
                  className="mt-1 w-full border px-2 py-1.5 text-sm"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-xs text-gray-500">
                  Price
                  <input value={slide.price} onChange={(event) => setSlides((current) => current.map((row) => row.key === slide.key ? { ...row, price: event.target.value } : row))} className="mt-1 w-full border px-2 py-1.5 text-sm" />
                </label>
                <label className="block text-xs text-gray-500">
                  MOQ
                  <input value={slide.moq} onChange={(event) => setSlides((current) => current.map((row) => row.key === slide.key ? { ...row, moq: event.target.value } : row))} className="mt-1 w-full border px-2 py-1.5 text-sm" />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
