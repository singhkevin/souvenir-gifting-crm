'use client'

import { removeQuotationLine, saveQuotationDraft, addQuotationProducts } from '../actions'
import { useAction } from '@/lib/use-action'
import { formatCurrency } from '@/lib/utils'
import { draftGstPercent } from '@/lib/quotes/flow'
import { ProductImage } from '@/components/ui/product-image'
import { ProductPickerDrawer, type PickerProduct } from '@/components/products/product-picker-drawer'
import { useState } from 'react'

type Line = {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  moq: number
}

export function QuotationDraftEditor({
  quotationId,
  discountPercent,
  taxPercent,
  validUntil,
  notes,
  lines,
  products,
}: {
  quotationId: string
  discountPercent: number
  taxPercent: number | null
  validUntil: string | null
  notes: string | null
  lines: Line[]
  products: PickerProduct[]
}) {
  const { pending, run } = useAction()
  const [discount, setDiscount] = useState(String(discountPercent || 0))
  const [gst, setGst] = useState(String(draftGstPercent(taxPercent)))
  const [until, setUntil] = useState(validUntil || '')
  const [note, setNote] = useState(notes || '')
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.id, String(line.quantity)])),
  )

  return (
    <div className="space-y-6 p-5 text-xs bg-[#FCF9F2]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Discount %</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={discount}
            disabled={pending}
            onChange={(event) => setDiscount(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { discountPercent: Number(discount) }), { successMessage: 'Discount saved' })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">GST %</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={gst}
            disabled={pending}
            placeholder="18"
            onChange={(event) => setGst(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { taxPercent: draftGstPercent(taxPercent, gst) }), { successMessage: 'GST saved' })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
          <span className="mt-1 block text-[10px] text-[#7C766F]">Blank saves as 18%.</span>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid Until</span>
          <input
            type="date"
            value={until}
            disabled={pending}
            onChange={(event) => setUntil(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { validUntil: until || null }), { successMessage: 'Validity saved' })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
          <textarea
            value={note}
            disabled={pending}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { notes: note }), { successMessage: 'Notes saved' })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="divide-y divide-[#CCC5BD] border border-[#CCC5BD] bg-[#FCF9F2] rounded-none">
        {lines.map((line) => {
          const quantity = Number(quantities[line.id])
          const belowMoq = line.moq > 1 && Number.isFinite(quantity) && quantity < line.moq
          return (
            <div key={line.id} className="flex flex-wrap items-center justify-between gap-4 p-3.5 hover:bg-[#F6F3EC] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <ProductImage src={line.imageUrl} alt={line.name} size="sm" className="shrink-0 rounded-none border border-[#CCC5BD]" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#1C1C18] truncate">{line.name}</p>
                  {line.sku && <p className="font-mono text-xs text-[#7C766F]">{line.sku}</p>}
                  <p className="mt-1 text-xs text-[#4A4640]">
                    <span className="font-mono text-[#1C1C18]">{formatCurrency(line.unitPrice)}</span> · ex-GST <span className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(line.lineTotal)}</span>
                  </p>
                  {belowMoq ? (
                    <p className="mt-1 inline-block text-xs font-semibold text-[#9E4300] bg-[#FFB690]/20 border border-[#9E4300]/30 px-2 py-0.5 rounded-none">
                      Quantity is below MOQ {line.moq}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <label className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Qty</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantities[line.id] ?? ''}
                    disabled={pending}
                    onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                    onBlur={() => run(() => saveQuotationDraft(quotationId, { lineId: line.id, quantity: Number(quantities[line.id]) }), { successMessage: 'Quantity saved' })}
                    className="w-20 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-1 text-right text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeQuotationLine(quotationId, line.id), { successMessage: 'Line removed' })}
                  className="rounded-none border border-[#BA1A1A]/40 bg-transparent px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#BA1A1A] hover:bg-[#BA1A1A] hover:text-[#FCF9F2] transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
        {lines.length === 0 ? <p className="p-4 text-center text-xs text-[#7C766F]">No line items yet.</p> : null}
      </div>

      <ProductPickerDrawer
        products={products}
        title="Add products"
        description="Search by name or SKU, filter by category and price, then add several lines with a quantity."
        onSubmit={(rows) => addQuotationProducts(quotationId, rows.map((row) => ({ productId: row.id, quantity: row.quantity })))}
      />
    </div>
  )
}
