'use client'

import { useState } from 'react'
import { sendQuotationToClient } from '../actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SendRecipient } from '@/lib/quotes/flow'

export function SendQuoteDialog({
  quotationId,
  total,
  validUntil,
  clientUrl,
  recipients,
  defaultRecipientKey,
  warnings,
}: {
  quotationId: string
  total: number
  validUntil: string | null
  clientUrl: string
  recipients: SendRecipient[]
  defaultRecipientKey: string | null
  warnings: string[]
}) {
  const [open, setOpen] = useState(false)
  const [recipientKey, setRecipientKey] = useState(defaultRecipientKey || '')
  const { pending, error, run, clearError } = useAction()
  const { key, rotate } = useIdempotencyKey()

  return (
    <>
      <button
        type="button"
        onClick={() => {
          clearError()
          setOpen(true)
        }}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
      >
        Send to client
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="send-quote-title">
            <h2 id="send-quote-title" className="text-base font-bold text-gray-900">Send to client</h2>
            <div className="space-y-2 text-xs text-gray-600">
              <p>Total incl. GST: <span className="font-semibold text-gray-900">{formatCurrency(total)}</span></p>
              <p>Valid until: <span className="font-semibold text-gray-900">{validUntil ? formatDate(validUntil) : 'Not set'}</span></p>
              <p>
                Portal link:{' '}
                <a href={clientUrl} className="break-all font-medium text-[#624B32] underline">{clientUrl}</a>
              </p>
            </div>
            <label className="block text-xs font-medium text-gray-700">
              Recipient
              <select
                value={recipientKey}
                onChange={(event) => setRecipientKey(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5"
              >
                <option value="">Choose a recipient</option>
                {recipients.map((recipient) => (
                  <option key={recipient.key} value={recipient.key}>{recipient.label}</option>
                ))}
              </select>
            </label>
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
            {error ? <p className="text-xs text-red-700" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold">
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !recipientKey}
                onClick={() => run(() => sendQuotationToClient(quotationId, recipientKey, key), {
                  successMessage: 'Quotation sent',
                  onSuccess: () => {
                    rotate()
                    setOpen(false)
                  },
                })}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {pending ? <span className="inline-flex items-center gap-2"><Spinner />Sending…</span> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
