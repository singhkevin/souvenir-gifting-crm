'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { respondToQuotation } from '../../actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency } from '@/lib/utils'

export type QuotationDecisionLine = {
  id: string
  name: string
  sku: string | null
  quantity: number
  unitPrice: number
  lineTotal: number
}

export function QuotationActions({
  quotationId,
  items,
  discountPercent,
  taxPercent,
}: {
  quotationId: string
  items: QuotationDecisionLine[]
  discountPercent: number
  taxPercent: number
}) {
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [responding, setResponding] = useState<'accepted' | 'rejected' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, true])),
  )

  const accepted = items.filter((item) => checked[item.id])
  const subtotal = accepted.reduce((sum, item) => sum + (Number(item.lineTotal) || 0), 0)
  const discount = subtotal * (Number(discountPercent) || 0) / 100
  const tax = (subtotal - discount) * (Number(taxPercent) || 0) / 100
  const estimate = { subtotal, discount, tax, total: subtotal - discount + tax }

  const handleRespond = (status: 'accepted' | 'rejected') => {
    if (status === 'rejected' && !rejecting) {
      setRejecting(true)
      return
    }
    if (status === 'accepted' && accepted.length === 0) {
      toast.error('Select at least one line to accept')
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
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">Your decision</h3>
      <p className="mb-4 text-sm text-gray-600">
        Accept the lines you want. Confirming creates an order for those lines only. Rejected lines stay on this quotation.
      </p>

      <ul className="divide-y rounded-xl border border-gray-200">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(checked[item.id])}
              onChange={() => setChecked((current) => ({ ...current, [item.id]: !current[item.id] }))}
              disabled={pending}
              aria-label={`Accept ${item.name}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">{item.name}</p>
              {item.sku && <p className="font-mono text-[10px] text-gray-400">{item.sku}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {item.quantity} × {formatCurrency(item.unitPrice)}
              </p>
            </div>
            <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.lineTotal)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1 text-xs text-gray-600 sm:ml-auto sm:w-64">
        <div className="flex justify-between">
          <span>Accepted subtotal</span>
          <span>{formatCurrency(estimate.subtotal)}</span>
        </div>
        {discountPercent > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount ({discountPercent}%)</span>
            <span>-{formatCurrency(estimate.discount)}</span>
          </div>
        )}
        {taxPercent > 0 && (
          <div className="flex justify-between">
            <span>Tax ({taxPercent}%)</span>
            <span>{formatCurrency(estimate.tax)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold text-gray-900">
          <span>Order total</span>
          <span>{formatCurrency(estimate.total)}</span>
        </div>
        <p className="pt-1 text-[11px] text-gray-500">Header discount and tax apply to the accepted subtotal.</p>
      </div>

      <label className="mb-4 mt-4 block text-sm font-medium text-gray-700">
        Note (optional)
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="mt-1 w-full rounded-md border p-2 outline-none focus:ring-[#806A50]"
          rows={3}
          disabled={pending}
        />
      </label>

      {rejecting ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleRespond('rejected')}
            disabled={pending}
            aria-busy={pending || undefined}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && responding === 'rejected' ? busyLabel('Rejecting…') : 'Confirm rejection'}
          </button>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            disabled={pending}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => handleRespond('accepted')}
            disabled={pending || accepted.length === 0}
            aria-busy={pending || undefined}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-6 py-2 font-semibold text-white shadow-sm hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending && responding === 'accepted' ? busyLabel('Accepting…') : 'Confirm and create order'}
          </button>
          <button
            type="button"
            onClick={() => handleRespond('rejected')}
            disabled={pending}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-6 py-2 font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject quotation
          </button>
        </div>
      )}
    </div>
  )
}
