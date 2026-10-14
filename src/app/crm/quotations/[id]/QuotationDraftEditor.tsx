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
    <div className="space-y-4 border-b border-gray-200 p-4 text-xs">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label>
          Discount %
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={discount}
            disabled={pending}
            onChange={(event) => setDiscount(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { discountPercent: Number(discount) }), { successMessage: 'Discount saved' })}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label>
          GST %
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
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
          <span className="text-[10px] text-gray-500">Blank saves as 18%.</span>
        </label>
        <label>
          Valid until
          <input
            type="date"
            value={until}
            disabled={pending}
            onChange={(event) => setUntil(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { validUntil: until || null }), { successMessage: 'Validity saved' })}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
        <label className="sm:col-span-2">
          Notes
          <textarea
            value={note}
            disabled={pending}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => run(() => saveQuotationDraft(quotationId, { notes: note }), { successMessage: 'Notes saved' })}
            className="mt-1 w-full rounded border px-2 py-1.5"
          />
        </label>
      </div>

      <div className="divide-y rounded-lg border border-gray-200">
        {lines.map((line) => {
          const quantity = Number(quantities[line.id])
          const belowMoq = line.moq > 1 && Number.isFinite(quantity) && quantity < line.moq
          return (
            <div key={line.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="flex items-start gap-3">
                <ProductImage src={line.imageUrl} alt={line.name} size="sm" className="shrink-0 rounded-lg" />
                <div>
                <p className="font-semibold text-gray-900">{line.name}</p>
                <p className="font-mono text-[10px] text-gray-400">{line.sku}</p>
                <p className="mt-1 text-gray-500">{formatCurrency(line.unitPrice)} · ex-GST {formatCurrency(line.lineTotal)}</p>
                {belowMoq ? <p className="mt-1 font-medium text-amber-800">Quantity is below MOQ {line.moq}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label>
                  Qty
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantities[line.id] ?? ''}
                    disabled={pending}
                    onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))}
                    onBlur={() => run(() => saveQuotationDraft(quotationId, { lineId: line.id, quantity: Number(quantities[line.id]) }), { successMessage: 'Quantity saved' })}
                    className="ml-1 w-20 rounded border px-2 py-1"
                  />
                </label>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeQuotationLine(quotationId, line.id), { successMessage: 'Line removed' })}
                  className="rounded border border-red-200 px-2 py-1 font-semibold text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
        {lines.length === 0 ? <p className="p-3 text-gray-400">No line items yet.</p> : null}
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
