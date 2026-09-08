'use client'

import { useFormStatus } from 'react-dom'
import { toggleOfferingSelectionForm } from './actions'

function ActionButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button disabled={pending} className={className}>
      {pending ? 'Saving…' : label}
    </button>
  )
}

export function OfferingActions({
  campaignId,
  campaignProductId,
  currentKind,
}: {
  campaignId: string
  campaignProductId: string
  currentKind: string | null
}) {
  const shortlisted = currentKind === 'shortlisted' || currentKind === 'selected'
  const selected = currentKind === 'selected'

  return (
    <div className="flex gap-2">
      <form action={toggleOfferingSelectionForm} className="flex-1">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_product_id" value={campaignProductId} />
        <input type="hidden" name="kind" value="shortlisted" />
        {shortlisted && !selected ? <input type="hidden" name="remove" value="1" /> : null}
        <ActionButton
          label={shortlisted && !selected ? 'Shortlisted' : 'Shortlist'}
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold ${
            shortlisted && !selected
              ? 'border border-green-200 bg-green-50 text-green-700'
              : 'border border-gray-300 bg-white text-gray-700'
          }`}
        />
      </form>
      <form action={toggleOfferingSelectionForm} className="flex-1">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_product_id" value={campaignProductId} />
        <input type="hidden" name="kind" value="selected" />
        {selected ? <input type="hidden" name="remove" value="1" /> : null}
        <ActionButton
          label={selected ? 'Selected' : 'Select'}
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold text-white ${
            selected ? 'bg-[#1A3022]' : 'bg-[#1A3022] hover:bg-[#274433]'
          }`}
        />
      </form>
    </div>
  )
}
