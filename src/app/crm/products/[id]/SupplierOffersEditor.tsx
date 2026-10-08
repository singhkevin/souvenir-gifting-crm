'use client'

import { useState } from 'react'
import { deleteSupplierOffer, saveSupplierOffer } from '../actions'
import { formatCurrency } from '@/lib/utils'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import type { SupplierOffer } from '@/lib/pricing/offers'

type SupplierOption = { id: string; name: string }

export function SupplierOffersEditor({
  productId,
  suppliers,
  offers,
  bestOfferId,
}: {
  productId: string
  suppliers: SupplierOption[]
  offers: SupplierOffer[]
  bestOfferId: string | null
}) {
  const { pending: saving, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '')
  const [sku, setSku] = useState('')
  const [cost, setCost] = useState('')
  const [moq, setMoq] = useState('1')
  const [lead, setLead] = useState('')
  const [inStock, setInStock] = useState(true)
  const [preferred, setPreferred] = useState(false)

  const save = (fields: Record<string, string>, rowId: string | null = null) => {
    const formData = new FormData()
    formData.set('product_id', productId)
    for (const [field, value] of Object.entries(fields)) formData.set(field, value)
    // Only creating an offer needs a key; updates set explicit values and are safe to repeat.
    if (!fields.offer_id) formData.set(IDEMPOTENCY_FIELD, key)
    setActiveId(rowId)
    run(() => saveSupplierOffer(formData), {
      successMessage: 'Supplier offer saved',
      onSuccess: () => {
        if (!fields.offer_id) {
          rotate()
          setSku('')
          setCost('')
          setMoq('1')
          setLead('')
          setPreferred(false)
        }
      },
    })
  }

  const remove = (offerId: string) => {
    const formData = new FormData()
    formData.set('offer_id', offerId)
    formData.set('product_id', productId)
    setActiveId(`remove:${offerId}`)
    run(() => deleteSupplierOffer(formData), { successMessage: 'Supplier offer removed' })
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900">Supplier offers</h2>
        <p className="mt-1 text-xs text-gray-500">
          Add each supplier&apos;s SKU, cost, MOQ, and lead time. Best is the lowest eligible cost. Pin one offer to override that.
          Clients never see these costs.
        </p>
      </div>

      {offers.length === 0 ? (
        <p className="text-xs text-gray-500">No supplier offers yet. The product cost is still used until you add one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-2 pr-3">Supplier</th>
                <th className="py-2 pr-3">Their SKU</th>
                <th className="py-2 pr-3 text-right">Cost</th>
                <th className="py-2 pr-3 text-right">MOQ</th>
                <th className="py-2 pr-3 text-right">Lead</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer.id} className="border-t border-gray-100">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-gray-900">{offer.supplier_name || 'Supplier'}</div>
                    {offer.id === bestOfferId && <div className="text-[10px] font-semibold uppercase text-emerald-700">Best</div>}
                    {offer.is_preferred && <div className="text-[10px] font-semibold uppercase text-[#806A50]">Pinned</div>}
                    {!offer.is_active && <div className="text-[10px] uppercase text-gray-400">Inactive</div>}
                  </td>
                  <td className="py-2 pr-3 font-mono">{offer.supplier_sku || '—'}</td>
                  <td className="py-2 pr-3 text-right">{formatCurrency(offer.cost)}</td>
                  <td className="py-2 pr-3 text-right">{offer.moq}</td>
                  <td className="py-2 pr-3 text-right">{offer.lead_time_days ?? '—'}</td>
                  <td className="py-2 pr-3">{offer.in_stock ? 'In stock' : 'Out'}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="mr-2 text-[#806A50]"
                      disabled={saving}
                      onClick={() => save({
                        offer_id: offer.id,
                        supplier_id: offer.supplier_id,
                        supplier_sku: offer.supplier_sku || '',
                        cost: String(offer.cost),
                        moq: String(offer.moq),
                        lead_time_days: offer.lead_time_days == null ? '' : String(offer.lead_time_days),
                        in_stock: offer.in_stock ? 'on' : 'off',
                        is_active: offer.is_active ? 'on' : 'off',
                        is_preferred: offer.is_preferred ? 'off' : 'on',
                      }, offer.id)}
                    >
                      {saving && activeId === offer.id ? (
                        <span className="inline-flex items-center gap-1"><Spinner />{offer.is_preferred ? 'Unpinning…' : 'Pinning…'}</span>
                      ) : offer.is_preferred ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      className="text-red-600"
                      disabled={saving}
                      onClick={() => remove(offer.id)}
                    >
                      {saving && activeId === `remove:${offer.id}` ? (
                        <span className="inline-flex items-center gap-1"><Spinner />Removing…</span>
                      ) : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Supplier</span>
          <select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs">
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Supplier SKU</span>
          <input value={sku} onChange={(event) => setSku(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Cost</span>
          <input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-500">MOQ</span>
          <input type="number" min="1" step="1" value={moq} onChange={(event) => setMoq(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Lead time (days)</span>
          <input type="number" min="0" step="1" value={lead} onChange={(event) => setLead(event.target.value)} className="mt-1 w-full rounded-lg border px-2 py-2 text-xs" />
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs">
          <input type="checkbox" checked={inStock} onChange={(event) => setInStock(event.target.checked)} />
          In stock
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs">
          <input type="checkbox" checked={preferred} onChange={(event) => setPreferred(event.target.checked)} />
          Pin as preferred
        </label>
      </div>
      <button
        type="button"
        disabled={saving || !supplierId}
        onClick={() => save({
          supplier_id: supplierId,
          supplier_sku: sku,
          cost,
          moq,
          lead_time_days: lead,
          in_stock: inStock ? 'on' : 'off',
          is_active: 'on',
          is_preferred: preferred ? 'on' : 'off',
        })}
        className="rounded-lg bg-[#806A50] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
      >
        {saving && activeId === null ? (
          <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
        ) : 'Add supplier offer'}
      </button>
    </div>
  )
}
