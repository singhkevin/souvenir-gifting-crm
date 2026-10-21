'use client'

import { useState } from 'react'
import { respondBusinessQuotation } from '@/app/business/actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export function QuoteResponse({
  quotationId,
  items,
}: {
  quotationId: string
  items: { id: string; name: string }[]
}) {
  const [action, setAction] = useState<'accept' | 'reject' | 'revise'>('accept')
  const [selected, setSelected] = useState<string[]>(items.map((item) => item.id))

  return (
    <ActionForm
      action={respondBusinessQuotation}
      className="space-y-4 border border-[#CCC5BD] bg-[#FCF9F2] p-5 sm:p-6 rounded-none"
      onSuccess={(result) => {
        const url = (result as { checkoutUrl?: string | null } | undefined)?.checkoutUrl
        if (url) window.location.assign(url)
      }}
    >
      <div className="border-b border-[#CCC5BD] pb-3">
        <h2 className="font-serif text-xl text-[#1C1C18]">Respond to Quote</h2>
        <p className="mt-1 text-xs text-[#7C766F]">Choose an action to proceed with this quotation.</p>
      </div>
      <input type="hidden" name="quotation_id" value={quotationId} />
      <input type="hidden" name="response_action" value={action} />
      <div className="inline-flex border border-[#CCC5BD] p-0.5 bg-[#F6F3EC]">
        {(['accept', 'reject', 'revise'] as const).map((value) => {
          const active = action === value
          const label = value === 'revise' ? 'Request revision' : value === 'accept' ? 'Accept quote' : 'Reject quote'
          return (
            <button
              key={value}
              type="button"
              onClick={() => setAction(value)}
              className={`px-3 py-1.5 sv2-label text-[10px] sm:text-[11px] transition-colors ${
                active
                  ? 'bg-[#000000] text-[#FCF9F2]'
                  : 'text-[#4A4640] hover:text-[#1C1C18]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {action === 'accept' ? (
        <fieldset className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 rounded-none space-y-2">
          <legend className="px-1 sv2-label text-[10px] text-[#4A4640]">Lines to accept</legend>
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2.5 text-sm text-[#1C1C18] cursor-pointer">
              <input
                type="checkbox"
                name="item_id"
                value={item.id}
                checked={selected.includes(item.id)}
                onChange={(event) => {
                  setSelected((current) =>
                    event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                  )
                }}
                className="h-4 w-4 rounded-none border-[#CCC5BD] text-[#9E4300] focus:ring-0"
              />
              <span>{item.name}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="block">
          <span className="sv2-label text-[10px] text-[#4A4640]">
            {action === 'revise' ? 'Revision details requested' : 'Reason for rejection'}
          </span>
          <textarea
            name="comment"
            required
            rows={3}
            className="mt-1 w-full border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1C18] focus:outline-none"
          />
        </label>
      )}
      <div>
        <SubmitButton
          pendingLabel="Saving…"
          className="bg-[#9E4300] px-5 py-2.5 sv2-label text-xs text-white hover:bg-[#783100] transition-colors rounded-none"
        >
          Save response
        </SubmitButton>
      </div>
    </ActionForm>
  )
}

