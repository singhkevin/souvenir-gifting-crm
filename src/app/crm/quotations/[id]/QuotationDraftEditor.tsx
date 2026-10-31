'use client'

import { useEffect, useState } from 'react'
import { removeQuotationLine, saveQuotationDraft, addQuotationProducts } from '../actions'
import { useAction } from '@/lib/use-action'
import { formatCurrency } from '@/lib/utils'
import { draftGstPercent, quoteLineTotal } from '@/lib/quotes/flow'
import { costingStatusLabel } from '@/lib/quotes/costing-draft'
import { ProductImage } from '@/components/ui/product-image'
import { ProductPickerDrawer, type PickerProduct } from '@/components/products/product-picker-drawer'
import { useQuotationLive } from './quotation-live'

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

type Fields = {
  discount: string
  gst: string
  until: string
  note: string
  quantities: Record<string, string>
}

function sameAmount(left: string, right: string) {
  if (left.trim() === '' && right.trim() === '') return true
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left === right
  return Math.abs(a - b) < 0.001
}

function fieldsDirty(current: Fields, saved: Fields, lineIds: string[]) {
  if (!sameAmount(current.discount, saved.discount)) return true
  if (!sameAmount(current.gst, saved.gst)) return true
  if (current.until !== saved.until || current.note !== saved.note) return true
  return lineIds.some((id) => !sameAmount(current.quantities[id] || '', saved.quantities[id] || ''))
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
  const { registerSaver, commitHeader, commitQuantity, lineById, snapshot } = useQuotationLive()
  const [fields, setFields] = useState<Fields>(() => ({
    discount: String(discountPercent || 0),
    gst: String(draftGstPercent(taxPercent)),
    until: validUntil || '',
    note: notes || '',
    quantities: Object.fromEntries(lines.map((line) => [line.id, String(line.quantity)])),
  }))
  const [baseline, setBaseline] = useState(fields)
  const lineKey = lines.map((line) => line.id).join('|')
  const [seenLines, setSeenLines] = useState(lineKey)
  if (seenLines !== lineKey) {
    setSeenLines(lineKey)
    const missing = lines.filter((line) => fields.quantities[line.id] == null)
    if (missing.length) {
      const quantities = { ...fields.quantities }
      const savedQuantities = { ...baseline.quantities }
      for (const line of missing) {
        const value = String(line.quantity)
        quantities[line.id] = value
        savedQuantities[line.id] = value
      }
      setFields({ ...fields, quantities })
      setBaseline({ ...baseline, quantities: savedQuantities })
    }
  }
  const lineIds = lines.map((line) => line.id)
  const dirty = fieldsDirty(fields, baseline, lineIds)

  function update(patch: Partial<Fields>) {
    setFields((current) => ({
      ...current,
      ...patch,
      quantities: patch.quantities ? { ...current.quantities, ...patch.quantities } : current.quantities,
    }))
  }

  function save(announce: boolean, current = fields) {
    if (current !== fields) setFields(current)
    if (!fieldsDirty(current, baseline, lineIds)) return
    const qtyLines = lines
      .filter((line) => !sameAmount(current.quantities[line.id] || '', baseline.quantities[line.id] || ''))
      .map((line) => ({ lineId: line.id, quantity: Number(current.quantities[line.id]) }))
    const tax = draftGstPercent(taxPercent, current.gst)
    const discount = Number(current.discount)
    run(() => saveQuotationDraft(quotationId, {
      discountPercent: discount,
      taxPercent: tax,
      validUntil: current.until || null,
      notes: current.note,
      lines: qtyLines,
    }), {
      successMessage: announce ? 'Draft saved' : false,
      onSuccess: () => {
        setBaseline(current)
        commitHeader({ discountPercent: discount, taxPercent: tax })
        for (const line of qtyLines) {
          if (Number.isFinite(line.quantity)) commitQuantity(line.lineId, line.quantity)
        }
      },
    })
  }

  useEffect(() => {
    registerSaver('draft', {
      dirty,
      saving: pending,
      save: () => save(true),
    })
  }, [dirty, pending, registerSaver, fields, baseline]) // eslint-disable-line react-hooks/exhaustive-deps -- save closes over fields and baseline

  const status = costingStatusLabel(pending, dirty)

  return (
    <div className="space-y-6 p-5 text-xs bg-[#FCF9F2]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[11px] font-bold uppercase tracking-[0.12em] ${dirty || pending ? 'text-[#9E4300]' : 'text-[#3A4537]'}`} aria-live="polite">
          Settings · {status}
        </p>
        {dirty ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => save(true)}
            disabled={pending}
            className="min-h-9 rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] disabled:opacity-50"
          >
            Save draft
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Discount %</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={fields.discount}
            disabled={pending}
            onChange={(event) => update({ discount: event.target.value })}
            onBlur={(event) => save(false, { ...fields, discount: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              save(true, { ...fields, discount: event.currentTarget.value })
            }}
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
            value={fields.gst}
            disabled={pending}
            placeholder="18"
            onChange={(event) => update({ gst: event.target.value })}
            onBlur={(event) => save(false, { ...fields, gst: event.currentTarget.value })}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              save(true, { ...fields, gst: event.currentTarget.value })
            }}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
          <span className="mt-1 block text-[10px] text-[#7C766F]">Blank saves as 18%.</span>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid Until</span>
          <input
            type="date"
            value={fields.until}
            disabled={pending}
            onChange={(event) => update({ until: event.target.value })}
            onBlur={(event) => save(false, { ...fields, until: event.currentTarget.value })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
          <textarea
            value={fields.note}
            disabled={pending}
            rows={3}
            onChange={(event) => update({ note: event.target.value })}
            onBlur={(event) => save(false, { ...fields, note: event.currentTarget.value })}
            className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
          />
        </label>
      </div>

      <div className="divide-y divide-[#CCC5BD] border border-[#CCC5BD] bg-[#FCF9F2] rounded-none">
        {lines.map((line) => {
          const quantity = Number(fields.quantities[line.id])
          const belowMoq = line.moq > 1 && Number.isFinite(quantity) && quantity < line.moq
          const committed = lineById(line.id)
          const unitPrice = committed?.unitPrice ?? line.unitPrice
          const committedQty = committed?.quantity ?? line.quantity
          const exGst = quoteLineTotal(committedQty, unitPrice, snapshot.discountPercent)
          const qtyDirty = !sameAmount(fields.quantities[line.id] || '', baseline.quantities[line.id] || '')
          return (
            <div key={line.id} className="flex flex-wrap items-center justify-between gap-4 p-3.5 hover:bg-[#F6F3EC] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <ProductImage src={line.imageUrl} alt={line.name} size="sm" className="shrink-0 rounded-none border border-[#CCC5BD]" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-[#1C1C18] truncate">{line.name}</p>
                  {line.sku && <p className="font-mono text-xs text-[#7C766F]">{line.sku}</p>}
                  <p className="mt-1 text-xs text-[#4A4640]">
                    <span className="font-mono text-[#1C1C18]">{formatCurrency(unitPrice)}</span> · ex-GST <span className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(exGst)}</span>
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
                    value={fields.quantities[line.id] ?? ''}
                    disabled={pending}
                    onChange={(event) => update({ quantities: { [line.id]: event.target.value } })}
                    onBlur={(event) => save(false, { ...fields, quantities: { ...fields.quantities, [line.id]: event.currentTarget.value } })}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      save(true, { ...fields, quantities: { ...fields.quantities, [line.id]: event.currentTarget.value } })
                    }}
                    className="w-20 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-1 text-right text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                {qtyDirty ? (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    disabled={pending}
                    onClick={() => save(true)}
                    className="text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:underline disabled:opacity-50"
                  >
                    Save
                  </button>
                ) : null}
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
        description="Search by name or SKU, filter by category, then add several lines with a quantity."
        onSubmit={(rows) => addQuotationProducts(quotationId, rows.map((row) => ({ productId: row.id, quantity: row.quantity })))}
      />
    </div>
  )
}
