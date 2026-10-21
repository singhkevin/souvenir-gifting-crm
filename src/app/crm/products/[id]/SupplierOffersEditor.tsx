'use client'

import { useState } from 'react'
import { createSupplier, deleteSupplierOffer, saveSupplierOffer } from '../actions'
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
  const [supplierRows, setSupplierRows] = useState(suppliers)
  const [newSupplier, setNewSupplier] = useState('')
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
    <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-5">
      <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6">
        <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Supplier offers</h2>
      </div>
      <p className="text-xs text-[#4A4640]">
        Add each supplier&apos;s SKU, cost, MOQ, and lead time. Best is the lowest eligible cost. Pin one offer to override that.
        Clients never see these costs.
      </p>

      {offers.length === 0 ? (
        <p className="text-xs text-[#7C766F]">No supplier offers yet. The product cost is still used until you add one.</p>
      ) : (
        <div className="overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <tr>
                <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Supplier</th>
                <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Their SKU</th>
                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Cost (₹)</th>
                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">MOQ</th>
                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Lead</th>
                <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Stock</th>
                <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
              {offers.map((offer) => (
                <tr key={offer.id} className="transition-colors hover:bg-[#F6F3EC]">
                  <td className="px-3.5 py-2.5">
                    <div className="font-semibold text-[#1C1B1A]">{offer.supplier_name || 'Supplier'}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {offer.id === bestOfferId && (
                        <span className="inline-flex items-center gap-1 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#3A4537]">
                          <span className="h-1 w-1 rounded-full bg-[#3A4537]" /> Best
                        </span>
                      )}
                      {offer.is_preferred && (
                        <span className="inline-flex items-center rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#9E4300]">
                          Pinned
                        </span>
                      )}
                      {!offer.is_active && (
                        <span className="inline-flex items-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#7C766F]">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[#1C1B1A]">{offer.supplier_sku || '—'}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">{formatCurrency(offer.cost)}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-[#1C1B1A]">{offer.moq}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono text-[#1C1B1A]">{offer.lead_time_days ?? '—'}</td>
                  <td className="px-3.5 py-2.5">
                    {offer.in_stock ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#3A4537]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> In stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[#BA1A1A]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> Out
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <button
                      type="button"
                      className="mr-3 text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:underline"
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
                      className="text-xs font-bold uppercase tracking-[0.12em] text-[#BA1A1A] hover:underline"
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

      <div className="grid grid-cols-1 gap-3 border-t border-[#CCC5BD] pt-5 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Supplier</span>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          >
            {supplierRows.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
          <span className="mt-2 flex gap-2">
            <input
              value={newSupplier}
              onChange={(event) => setNewSupplier(event.target.value)}
              placeholder="New supplier"
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-1.5 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              className="shrink-0 rounded-none border border-[#1C1B1A] bg-transparent px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors disabled:opacity-50"
              disabled={saving || !newSupplier.trim()}
              onClick={() => {
                setActiveId('supplier')
                run(async () => {
                  const created = await createSupplier(newSupplier)
                  if ('error' in created) return created
                  setSupplierRows((current) => current.some((row) => row.id === created.id) ? current : [...current, created])
                  setSupplierId(created.id)
                  setNewSupplier('')
                  return { success: true }
                }, { successMessage: 'Supplier added' })
              }}
            >
              Add
            </button>
          </span>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Supplier SKU</span>
          <input
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono uppercase text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Cost</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">MOQ</span>
          <input
            type="number"
            min="1"
            step="1"
            value={moq}
            onChange={(event) => setMoq(event.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Lead time (days)</span>
          <input
            type="number"
            min="0"
            step="1"
            value={lead}
            onChange={(event) => setLead(event.target.value)}
            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs text-[#4A4640] cursor-pointer">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(event) => setInStock(event.target.checked)}
            className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0"
          />
          In stock
        </label>
        <label className="flex items-center gap-2 pt-6 text-xs text-[#4A4640] cursor-pointer">
          <input
            type="checkbox"
            checked={preferred}
            onChange={(event) => setPreferred(event.target.checked)}
            className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0"
          />
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
        className="rounded-none bg-[#1C1B1A] px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors disabled:opacity-50"
      >
        {saving && activeId === null ? (
          <span className="inline-flex items-center gap-2"><Spinner />Saving…</span>
        ) : 'Add supplier offer'}
      </button>
    </div>
  )
}
