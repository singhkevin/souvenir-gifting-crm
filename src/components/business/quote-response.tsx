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
      className="space-y-3 rounded-lg border border-[#E8E4DE] bg-white p-4"
      onSuccess={(result) => {
        const url = (result as { checkoutUrl?: string | null } | undefined)?.checkoutUrl
        if (url) window.location.assign(url)
      }}
    >
      <input type="hidden" name="quotation_id" value={quotationId} />
      <input type="hidden" name="response_action" value={action} />
      <div className="flex flex-wrap gap-2 text-sm">
        {(['accept', 'reject', 'revise'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setAction(value)}
            className={`rounded-md px-3 py-1.5 capitalize ${action === value ? 'bg-[#806A50] text-white' : 'border border-[#E5DFD5]'}`}
          >
            {value === 'revise' ? 'Request revision' : value}
          </button>
        ))}
      </div>
      {action === 'accept' ? (
        <fieldset className="space-y-2 text-sm">
          <legend>Lines to accept</legend>
          {items.map((item) => (
            <label key={item.id} className="flex items-center gap-2">
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
              />
              {item.name}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="block text-sm">
          Comment
          <textarea name="comment" required rows={3} className="mt-1 w-full rounded-md border border-[#E5DFD5] px-3 py-2" />
        </label>
      )}
      <SubmitButton
        pendingLabel="Saving…"
        className="bg-[#806A50] px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-white"
      >
        Save response
      </SubmitButton>
    </ActionForm>
  )
}
