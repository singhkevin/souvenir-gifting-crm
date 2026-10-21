'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { parseCsv } from '@/lib/csv'
import { fixedPriceBlockReason, type PricingPortal } from '@/lib/pricing/engine'
import {
  applyPricingCsv,
  bulkAdjustPrices,
  setCostPrice,
  setPortalFixedPrice,
  setRetailPrice,
  useBestOfferAsCost,
} from './actions'
import type { GridRow } from './load'

const PORTALS: PricingPortal[] = ['store', 'business', 'corporate']

function amount(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

type ImportRow = {
  sku: string
  cost?: number | null
  retail?: number | null
  store?: number | null
  business?: number | null
  corporate?: number | null
  note: string
}

function parseCell(value: string): number | null | undefined | 'bad' {
  const raw = value.trim()
  if (!raw) return undefined
  if (/^clear$/i.test(raw)) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 'bad'
  return n
}

export function PriceGrid({
  rows,
  canEdit,
  showCost,
  floors,
}: {
  rows: GridRow[]
  canEdit: boolean
  showCost: boolean
  floors: Record<PricingPortal, number>
}) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [missingCost, setMissingCost] = useState(false)
  const [belowFloor, setBelowFloor] = useState(false)
  const [fixedOnly, setFixedOnly] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const categories = useMemo(() => [...new Set(rows.map((row) => row.category).filter(Boolean))] as string[], [rows])

  const visible = rows.filter((row) => {
    const haystack = `${row.name} ${row.sku}`.toLowerCase()
    if (query && !haystack.includes(query.trim().toLowerCase())) return false
    if (category && row.category !== category) return false
    if (missingCost && row.cost != null) return false
    if (belowFloor && ![row.store, row.business, row.corporate].some((cell) => cell.belowFloor)) return false
    if (fixedOnly && ![row.store, row.business, row.corporate].some((cell) => cell.source === 'Fixed')) return false
    return true
  })

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  function onCsv(file: File | null) {
    if (!file) return
    file.text().then((text) => {
      const table = parseCsv(text)
      const header = table.headers.map((item) => item.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))
      const index = (name: string) => header.indexOf(name)
      const skuIndex = index('sku')
      if (skuIndex < 0) {
        setImportRows([{ sku: '', note: 'The file needs a sku column.' }])
        return
      }
      const bySku = new Map(rows.map((row) => [row.sku.toUpperCase(), row]))
      const next: ImportRow[] = []
      for (const cells of table.rows) {
        const sku = (cells[skuIndex] || '').trim().toUpperCase()
        const read = (name: string) => {
          const at = index(name)
          return at < 0 ? undefined : parseCell(cells[at] || '')
        }
        const change: ImportRow = { sku, note: '' }
        const cost = read('cost_price')
        const retail = read('retail_price')
        const store = read('store_fixed_price')
        const business = read('business_fixed_price')
        const corporate = read('corporate_fixed_price')
        if (cost !== undefined) change.cost = cost === 'bad' ? null : cost
        if (retail !== undefined) change.retail = retail === 'bad' ? null : retail
        if (store !== undefined) change.store = store === 'bad' ? null : store
        if (business !== undefined) change.business = business === 'bad' ? null : business
        if (corporate !== undefined) change.corporate = corporate === 'bad' ? null : corporate
        const product = bySku.get(sku)
        if (!product) change.note = 'Product not found'
        else if ([cost, retail, store, business, corporate].includes('bad')) change.note = 'A price is not a number'
        else {
          for (const portal of PORTALS) {
            const price = change[portal]
            if (price == null) continue
            const blocked = fixedPriceBlockReason(price, product.cost, floors[portal])
            if (blocked) change.note = blocked
          }
        }
        if (cost !== undefined || retail !== undefined || store !== undefined || business !== undefined || corporate !== undefined) {
          next.push(change)
        }
      }
      setImportRows(next)
    })
  }

  const importable = importRows.filter((row) => row.sku && !row.note)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="text-xs text-gray-500">
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Name or SKU" />
        </label>
        <label className="text-xs text-gray-500">
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">All</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {showCost ? <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={missingCost} onChange={(event) => setMissingCost(event.target.checked)} /> Missing cost</label> : null}
        {showCost ? <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={belowFloor} onChange={(event) => setBelowFloor(event.target.checked)} /> Below floor</label> : null}
        <label className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={fixedOnly} onChange={(event) => setFixedOnly(event.target.checked)} /> Has fixed price</label>
        <a href="/crm/pricing/export" className="text-sm font-medium text-[#806A50] underline">Export CSV</a>
      </div>

      {canEdit ? (
        <ActionForm action={bulkAdjustPrices} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <input type="hidden" name="product_ids" value={(selected.length ? selected : visible.map((row) => row.id)).join(',')} />
          <p className="text-xs text-gray-500">{selected.length ? `${selected.length} selected` : `${visible.length} in the current filter`}</p>
          <label className="text-xs text-gray-500">
            Portal
            <select name="portal" className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm" defaultValue="business">
              {PORTALS.map((portal) => <option key={portal} value={portal}>{portal}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Change by %
            <input name="percent" type="number" step="0.01" required className="mt-1 block w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="10" />
          </label>
          <SubmitButton className="rounded-lg border border-[#806A50] px-3 py-2 text-sm font-medium text-[#806A50]" pendingLabel="Updating…">
            Apply % as fixed prices
          </SubmitButton>
        </ActionForm>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[980px] text-xs">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="p-3" />
              <th className="p-3 font-medium">Product</th>
              {showCost ? <th className="p-3 font-medium">Cost</th> : null}
              <th className="p-3 font-medium">Retail</th>
              <th className="p-3 font-medium">Store</th>
              <th className="p-3 font-medium">Business</th>
              <th className="p-3 font-medium">Corporate</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id} className="border-t border-gray-100 align-top">
                <td className="p-3">
                  <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} aria-label={`Select ${row.name}`} />
                </td>
                <td className="p-3">
                  <p className="font-medium text-gray-900">{row.name}</p>
                  <p className="font-mono text-[10px] text-gray-400">{row.sku}</p>
                  <p className="text-[10px] text-gray-500">{row.category || 'Uncategorised'}</p>
                  <Link href={`/crm/pricing?tab=Price%20grid&product=${row.id}`} className="text-[11px] font-medium text-[#806A50] underline">Where is this price?</Link>
                </td>
                {showCost ? (
                  <td className="p-3">
                    <p>{amount(row.cost)}</p>
                    {canEdit ? <PriceField action={setCostPrice} productId={row.id} price={row.cost} allowBlank /> : null}
                    {canEdit ? (
                      <ActionForm action={useBestOfferAsCost} className="mt-1">
                        <input type="hidden" name="product_id" value={row.id} />
                        <button type="submit" className="text-[11px] text-[#806A50] underline">Use best offer as cost</button>
                      </ActionForm>
                    ) : null}
                  </td>
                ) : null}
                <td className="p-3">
                  <p>{amount(row.retail)}</p>
                  {canEdit ? <PriceField action={setRetailPrice} productId={row.id} price={row.retail} /> : null}
                </td>
                <PortalCell row={row} portal="store" canEdit={canEdit} showCost={showCost} />
                <PortalCell row={row} portal="business" canEdit={canEdit} showCost={showCost} />
                <PortalCell row={row} portal="corporate" canEdit={canEdit} showCost={showCost} />
              </tr>
            ))}
            {visible.length === 0 ? (
              <tr><td colSpan={showCost ? 7 : 6} className="p-6 text-center text-gray-500">No products match these filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Import CSV</h2>
          <p className="text-xs text-gray-500">Columns: sku, cost_price, retail_price, store_fixed_price, business_fixed_price, corporate_fixed_price. A blank cell is left unchanged. Type clear to remove a portal fixed price.</p>
          <input type="file" accept=".csv,text/csv" onChange={(event) => onCsv(event.target.files?.[0] || null)} className="text-sm" />
          {importRows.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-gray-500"><tr><th className="py-1 pr-3">SKU</th><th className="py-1 pr-3">Change</th><th className="py-1">Check</th></tr></thead>
                  <tbody>
                    {importRows.slice(0, 30).map((row, index) => (
                      <tr key={`${row.sku}-${index}`} className="border-t border-gray-100">
                        <td className="py-1 pr-3 font-mono">{row.sku || '—'}</td>
                        <td className="py-1 pr-3">{['cost', 'retail', 'store', 'business', 'corporate'].filter((key) => key in row).join(', ') || '—'}</td>
                        <td className="py-1">{row.note || 'Ready'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActionForm action={applyPricingCsv}>
                <input type="hidden" name="changes" value={JSON.stringify(importable.map(({ note: _note, ...row }) => row))} />
                <SubmitButton className="rounded-lg bg-[#806A50] px-4 py-2 text-sm font-medium text-white" pendingLabel="Importing…">
                  Apply {importable.length} ready {importable.length === 1 ? 'row' : 'rows'}
                </SubmitButton>
              </ActionForm>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function PortalCell({
  row,
  portal,
  canEdit,
  showCost,
}: {
  row: GridRow
  portal: PricingPortal
  canEdit: boolean
  showCost: boolean
}) {
  const cell = row[portal]
  return (
    <td className="p-3">
      <p className="font-medium text-gray-900">{cell.price == null ? 'Price on quote' : amount(cell.price)}</p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{cell.source}</p>
      {showCost && cell.marginOverCost != null ? <p className="text-[10px] text-gray-500">{cell.marginOverCost}% over cost</p> : null}
      {showCost && cell.belowFloor ? <p className="text-[10px] text-amber-800">Below floor</p> : null}
      {canEdit ? (
        <ActionForm action={setPortalFixedPrice} className="mt-1 flex flex-wrap items-center gap-1">
          <input type="hidden" name="product_id" value={row.id} />
          <input type="hidden" name="portal" value={portal} />
          <input name="price" type="number" min="0" step="0.01" defaultValue={cell.source === 'Fixed' ? cell.price ?? '' : ''} placeholder="Fixed" className="w-24 rounded border border-gray-200 px-2 py-1" />
          <button type="submit" className="text-[11px] font-medium text-[#806A50]">Set</button>
          {cell.source === 'Fixed' ? <button type="submit" name="clear" value="1" className="text-[11px] text-gray-500 underline">Clear</button> : null}
        </ActionForm>
      ) : null}
    </td>
  )
}

function PriceField({
  action,
  productId,
  price,
  allowBlank = false,
}: {
  action: (formData: FormData) => Promise<unknown>
  productId: string
  price: number | null
  allowBlank?: boolean
}) {
  return (
    <ActionForm action={action} className="mt-1 flex items-center gap-1">
      <input type="hidden" name="product_id" value={productId} />
      <input name="price" type="number" min="0" step="0.01" defaultValue={price ?? ''} placeholder={allowBlank ? 'Blank clears' : ''} className="w-24 rounded border border-gray-200 px-2 py-1" />
      <button type="submit" className="text-[11px] font-medium text-[#806A50]">Save</button>
    </ActionForm>
  )
}
