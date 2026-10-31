'use client'

import { useState } from 'react'
import { sendQuotationToClient } from '../actions'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { SendRecipient } from '@/lib/quotes/flow'
import { useQuotationLive } from './quotation-live'

export function SendQuoteDialog({
  quotationId,
  validUntil,
  clientUrl,
  recipients,
  defaultRecipientKey,
  warnings,
}: {
  quotationId: string
  validUntil: string | null
  clientUrl: string
  recipients: SendRecipient[]
  defaultRecipientKey: string | null
  warnings: string[]
}) {
  const { totals } = useQuotationLive()
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
        className="px-4 py-2 bg-[#1C1B1A] hover:bg-[#9E4300] text-[#FCF9F2] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center justify-center"
      >
        Send to client
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md space-y-4 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 shadow-none" role="dialog" aria-modal="true" aria-labelledby="send-quote-title">
            <h2 id="send-quote-title" className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1C18]">Send to Client</h2>
            <div className="space-y-2 border border-[#CCC5BD] bg-[#F6F3EC] p-3 text-xs text-[#4A4640]">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total incl. GST</span>
                <span className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid until</span>
                <span className="text-[#1C1C18]">{validUntil ? formatDate(validUntil) : 'Not set'}</span>
              </div>
              <div className="pt-2 border-t border-[#CCC5BD]">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Portal link</span>
                <a href={clientUrl} className="break-all font-mono text-[11px] text-[#9E4300] underline hover:text-[#7A3400] transition-colors">{clientUrl}</a>
              </div>
            </div>
            <label className="block">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Recipient</span>
              <select
                value={recipientKey}
                onChange={(event) => setRecipientKey(event.target.value)}
                className="mt-1 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              >
                <option value="">Choose a recipient</option>
                {recipients.map((recipient) => (
                  <option key={recipient.key} value={recipient.key}>{recipient.label}</option>
                ))}
              </select>
            </label>
            {warnings.length > 0 && (
              <ul className="space-y-1 rounded-none border border-[#9E4300]/30 bg-[#FFB690]/20 px-3 py-2 text-xs text-[#9E4300]">
                {warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            )}
            {error ? <p className="text-xs text-[#BA1A1A] bg-[#FBEDEB] border border-[#BA1A1A]/40 px-3 py-2 rounded-none" role="alert">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-none border border-[#1C1B1A] bg-transparent px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#1C1B1A] hover:text-[#FCF9F2] transition-colors disabled:opacity-50"
              >
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
                className="rounded-none bg-[#1C1B1A] hover:bg-[#9E4300] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors disabled:opacity-50"
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
