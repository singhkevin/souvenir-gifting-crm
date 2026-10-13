'use client'

import { useState } from 'react'
import { setQuotationContact } from '../actions'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

export function QuoteContactPicker({
  quotationId,
  contacts,
}: {
  quotationId: string
  contacts: { id: string; full_name: string | null; email: string | null }[]
}) {
  const [contactId, setContactId] = useState('')
  const { pending, run } = useAction()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold text-amber-800">No contact — choose one</span>
      <select
        value={contactId}
        onChange={(event) => setContactId(event.target.value)}
        aria-label="Choose a contact"
        className="rounded border border-gray-200 px-2 py-1"
      >
        <option value="">Select</option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.full_name || 'Contact'}{contact.email ? ` · ${contact.email}` : ''}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending || !contactId}
        onClick={() => run(() => setQuotationContact(quotationId, contactId), { successMessage: 'Contact saved' })}
        className="rounded bg-[#624B32] px-2 py-1 font-semibold text-white disabled:opacity-50"
      >
        {pending ? <Spinner /> : 'Save'}
      </button>
    </div>
  )
}
