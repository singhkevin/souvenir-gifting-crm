'use client'

import { useState } from 'react'
import { addQuotationProduct, removeQuotationLine, saveQuotationDraft, searchQuoteProducts } from '../actions'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency } from '@/lib/utils'
import { draftGstPercent } from '@/lib/quotes/flow'

type Line = {
  id: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
  moq: number
}

type FoundProduct = { id: string; name: string | null; sku: string | null; moq: number | null; price: number | null }

export function QuotationDraftEditor({
  quotationId,
  discountPercent,
  taxPercent,
  validUntil,
  notes,
  lines,
}: {
  quotationId: string
  discountPercent: number
  taxPercent: number | null
  validUntil: string | null
  notes: string | null
  lines: Line[]
}) {
  const { pending, run } = useAction()
  const [discount, setDiscount] = useState(String(discountPercent || 0))
  const [gst, setGst] = useState(String(draftGstPercent(taxPercent)))
  const [until, setUntil] = useState(validUntil || '')
  const [note, setNote] = useState(notes || '')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<FoundProduct[]>([])
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
              <div>
                <p className="font-semibold text-gray-900">{line.name}</p>
                <p className="font-mono text-[10px] text-gray-400">{line.sku}</p>
                <p className="mt-1 text-gray-500">{formatCurrency(line.unitPrice)} · ex-GST {formatCurrency(line.lineTotal)}</p>
                {belowMoq ? <p className="mt-1 font-medium text-amber-800">Quantity is below MOQ {line.moq}</p> : null}
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

      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products to add"
            className="w-full rounded border px-2 py-1.5"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(async () => {
              const result = await searchQuoteProducts(quotationId, query)
              if (result && 'products' in result) setFound(result.products as FoundProduct[])
              return result
            }, { successMessage: false })}
            className="rounded bg-gray-100 px-3 py-1.5 font-semibold"
          >
            {pending ? <Spinner /> : 'Search'}
          </button>
        </div>
        {found.map((product) => (
          <div key={product.id} className="flex items-center justify-between gap-2">
            <span>{product.name} <span className="font-mono text-[10px] text-gray-400">{product.sku}</span></span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => addQuotationProduct(quotationId, product.id), { successMessage: 'Product added' })}
              className="rounded bg-[#624B32] px-2 py-1 font-semibold text-white"
            >
              Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
