'use client'

import { useMemo, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'
import { parseSizeOptions } from '@/lib/gifts/rules'

export type GiftPickerProduct = {
  id: string
  name: string
  sku: string
  image_url: string | null
}

type Chosen = {
  key: string
  kind: 'product' | 'combo'
  productId: string | null
  productIds: string[]
  title: string
  imageUrl: string | null
  memberNames: string[]
  sizes: string
}

export function GiftItemPicker({
  products,
  initial,
  locked = false,
}: {
  products: GiftPickerProduct[]
  initial?: Chosen[]
  locked?: boolean
}) {
  const [query, setQuery] = useState('')
  const [checked, setChecked] = useState<string[]>([])
  const [comboName, setComboName] = useState('')
  const [chosen, setChosen] = useState<Chosen[]>(initial || [])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return products.slice(0, 48)
    return products
      .filter((product) =>
        product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle),
      )
      .slice(0, 48)
  }, [products, query])

  const payload = chosen.map((item) => ({
    kind: item.kind,
    productId: item.productId,
    productIds: item.productIds,
    title: item.title,
    sizeOptions: parseSizeOptions(item.sizes),
  }))

  function addProduct(product: GiftPickerProduct) {
    if (chosen.some((item) => item.kind === 'product' && item.productId === product.id)) return
    setChosen((current) => [
      ...current,
      {
        key: `product-${product.id}`,
        kind: 'product',
        productId: product.id,
        productIds: [],
        title: product.name,
        imageUrl: product.image_url,
        memberNames: [],
        sizes: '',
      },
    ])
  }

  function addCombo() {
    const members = products.filter((product) => checked.includes(product.id))
    if (members.length < 2 || !comboName.trim()) return
    setChosen((current) => [
      ...current,
      {
        key: `combo-${Date.now()}`,
        kind: 'combo',
        productId: null,
        productIds: members.map((product) => product.id),
        title: comboName.trim(),
        imageUrl: members[0]?.image_url || null,
        memberNames: members.map((product) => product.name),
        sizes: '',
      },
    ])
    setChecked([])
    setComboName('')
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name="items_json" value={JSON.stringify(payload)} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div>
          <label className="block text-xs text-gray-500">
            Shortlist
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              disabled={locked}
            />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visible.map((product) => {
              const on = checked.includes(product.id)
              return (
                <div key={product.id} className="rounded-xl border bg-white p-2">
                  <div className="aspect-square overflow-hidden rounded-lg bg-[#F6F4F1]">
                    <ProductImage src={product.image_url} alt={product.name} size="md" fit="contain" className="h-full w-full bg-transparent" />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-gray-900">{product.name}</p>
                  <p className="text-[11px] text-gray-500">{product.sku}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => addProduct(product)}
                      className="rounded-md bg-[#241C12] px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() =>
                        setChecked((current) =>
                          current.includes(product.id)
                            ? current.filter((id) => id !== product.id)
                            : [...current, product.id],
                        )
                      }
                      className={`rounded-md border px-2 py-1 text-[11px] ${on ? 'border-[#806A50] text-[#806A50]' : 'text-gray-600'}`}
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
              <input
                value={comboName}
                onChange={(event) => setComboName(event.target.value)}
                placeholder="Welcome kit"
                disabled={locked}
                className="mt-1 rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={locked || checked.length < 2 || !comboName.trim()}
              onClick={addCombo}
              className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40"
            >
              Add combo ({checked.length})
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Employees pick one</p>
          {chosen.length === 0 ? <p className="text-sm text-gray-500">Nothing shortlisted yet.</p> : null}
          {chosen.map((item) => (
            <div key={item.key} className="rounded-xl border p-3">
              <div className="flex gap-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg bg-[#F6F4F1]">
                  <ProductImage src={item.imageUrl} alt="" size="sm" fit="contain" className="h-full w-full bg-transparent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">{item.kind}</p>
                  {item.memberNames.length ? (
                    <p className="mt-1 text-xs text-gray-500">{item.memberNames.join(', ')}</p>
                  ) : null}
                </div>
                {locked ? null : (
                  <button
                    type="button"
                    className="text-xs text-red-700"
                    onClick={() => setChosen((current) => current.filter((row) => row.key !== item.key))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <label className="mt-2 block text-xs text-gray-500">
                Sizes, optional (S, M, L, XL)
                <input
                  value={item.sizes}
                  disabled={locked}
                  onChange={(event) =>
                    setChosen((current) =>
                      current.map((row) => (row.key === item.key ? { ...row, sizes: event.target.value } : row)),
                    )
                  }
                  className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
