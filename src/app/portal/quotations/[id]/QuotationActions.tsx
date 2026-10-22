'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { requestQuotationChanges, respondToQuotation } from '../../actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency, formatDate } from '@/lib/utils'
import { estimateTickedLines } from '@/lib/quotes/flow'
import { ProductThumb } from '@/components/ui/product-thumb'

export type QuotationDecisionLine = {
  id: string
  name: string
  sku: string | null
  imageUrl?: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export function QuotationActions({
  quotationId,
  items,
  discountPercent,
  taxPercent,
  validUntil,
}: {
  quotationId: string
  items: QuotationDecisionLine[]
  discountPercent: number
  taxPercent: number
  validUntil: string | null
}) {
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [responding, setResponding] = useState<'accepted' | 'rejected' | 'changes' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [changing, setChanging] = useState(false)
  const [comment, setComment] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, true])),
  )

  const accepted = items.filter((item) => checked[item.id])
  const estimate = estimateTickedLines(
    items.map((item) => ({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      ticked: Boolean(checked[item.id]),
    })),
    taxPercent,
  )

  const handleRespond = (status: 'accepted' | 'rejected') => {
    if (status === 'rejected' && !rejecting) {
      setRejecting(true)
      return
    }
    if (status === 'accepted' && accepted.length === 0) {
      toast.error('Choose at least one line to accept')
      return
    }

    setResponding(status)
    run(
      () =>
        respondToQuotation(
          quotationId,
          status,
          comment,
          status === 'accepted' ? accepted.map((item) => item.id) : undefined,
          key,
        ),
      {
        successMessage: status === 'accepted' ? 'Order created for the accepted lines' : 'Response recorded',
        onSuccess: () => {
          rotate()
          setRejecting(false)
        },
      },
    )
  }

  const busyLabel = (label: string) => (
    <span className="inline-flex items-center justify-center gap-2">
      <Spinner />
      {label}
    </span>
  )

  return (
    <div className="space-y-6 pt-2">
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300] mb-1">
          Quotation · Review
        </span>
        <h3 className="font-serif text-2xl text-[#1C1C18]">Your decision</h3>
        <p className="mt-1 text-sm text-[#4A4640]">
          Accept the lines you want. Confirming creates an order for those lines only. Declined lines stay on this quote.
        </p>
      </div>

      {/* Decision Lines Checklist */}
      <div className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 p-4 hover:bg-[#F6F3EC] transition-colors">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded-none border border-[#CCC5BD] text-[#1C1B1A] focus:ring-0 accent-[#1C1B1A]"
              checked={Boolean(checked[item.id])}
              onChange={() => setChecked((current) => ({ ...current, [item.id]: !current[item.id] }))}
              disabled={pending}
              aria-label={`Accept ${item.name}`}
            />
            <ProductThumb src={item.imageUrl} alt={item.name} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1C1C18]">{item.name}</p>
              {item.sku && <p className="font-mono text-[10px] text-[#7C766F] mt-0.5">SKU: {item.sku}</p>}
              <p className="font-mono text-xs text-[#7C766F] mt-1">
                {item.quantity} units × {formatCurrency(item.unitPrice)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-mono text-sm font-semibold text-[#1C1C18]">
                {formatCurrency(item.lineTotal)}
              </p>
              <span className="block text-[10px] font-mono text-[#7C766F]">ex-GST</span>
            </div>
          </div>
        ))}
      </div>

      {/* Estimate Summary Box */}
      <div className="border border-[#CCC5BD] bg-white p-4 rounded-none space-y-2 text-xs sm:ml-auto sm:w-80">
        <div className="flex justify-between text-[#4A4640]">
          <span>Accepted subtotal (ex-GST):</span>
          <span className="font-mono font-medium text-[#1C1C18]">{formatCurrency(estimate.subtotal)}</span>
        </div>
        {discountPercent > 0 && (
          <div className="flex justify-between text-[#9E4300] font-medium">
            <span>Discount ({discountPercent}%):</span>
            <span className="font-mono">-{formatCurrency(estimate.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[#4A4640]">
          <span>GST ({taxPercent || 0}%):</span>
          <span className="font-mono font-medium text-[#1C1C18]">{formatCurrency(estimate.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-[#CCC5BD] pt-2 text-sm font-bold text-[#1C1C18]">
          <span className="uppercase tracking-wider text-xs">Total incl. GST:</span>
          <span className="font-mono">{formatCurrency(estimate.total)}</span>
        </div>
        <p className="pt-1 text-[10px] text-[#7C766F]">
          Line amounts are ex-GST. Discount is taken once, then GST is added once.
          {validUntil ? ` Valid until ${formatDate(validUntil)}.` : ''}
        </p>
      </div>

      {/* Decision Note Field */}
      <div>
        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
          Note (optional)
        </label>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="w-full bg-[#F1EEE7] border border-[#CCC5BD] p-3 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
          placeholder="Anything the team should know"
          rows={3}
          disabled={pending}
        />
      </div>

      {/* Decision Buttons */}
      {rejecting ? (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleRespond('rejected')}
            disabled={pending}
            aria-busy={pending || undefined}
            className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] bg-[#BA1A1A] hover:bg-[#93000A] text-white rounded-none disabled:opacity-50 transition-colors"
          >
            {pending && responding === 'rejected' ? busyLabel('Rejecting…') : 'Confirm rejection'}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] text-[#1C1C18] bg-white hover:bg-[#F6F3EC] rounded-none disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleRespond('accepted')}
            disabled={pending || accepted.length === 0}
            aria-busy={pending || undefined}
            className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] bg-[#9E4300] hover:bg-[#FF8843] text-white rounded-none disabled:opacity-50 transition-colors"
          >
            {pending && responding === 'accepted' ? busyLabel('Accepting…') : 'Confirm and create order'}
          </button>
          <button
            type="button"
            onClick={() => handleRespond('rejected')}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#BA1A1A] text-[#BA1A1A] bg-transparent hover:bg-[#FFDAD6]/30 rounded-none disabled:opacity-50 transition-colors"
          >
            Decline quote
          </button>
          <button
            type="button"
            onClick={() => setChanging(true)}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] text-[#1C1B1A] bg-transparent hover:bg-[#F6F3EC] rounded-none disabled:opacity-50 transition-colors"
          >
            Request changes
          </button>
        </div>
      )}

      {/* Changes Request Box */}
      {changing && (
        <div className="p-4 bg-[#FFDBCB]/30 border-l-4 border-l-[#9E4300] space-y-3 rounded-none">
          <p className="text-xs text-[#1C1C18] font-medium">
            Add what should change in the note above, then send the request.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={pending || !comment.trim()}
              onClick={() => {
                setResponding('changes')
                run(() => requestQuotationChanges(quotationId, comment.trim(), key), {
                  successMessage: 'Change request sent',
                  onSuccess: () => {
                    rotate()
                    setChanging(false)
                  },
                })
              }}
              className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] bg-[#1C1B1A] hover:bg-[#9E4300] text-white rounded-none disabled:opacity-50 transition-colors"
            >
              {pending && responding === 'changes' ? busyLabel('Sending…') : 'Send request'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setChanging(false)}
              className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] text-[#1C1C18] bg-white hover:bg-[#F6F3EC] rounded-none transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
