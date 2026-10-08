'use client'

import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleOfferingSelectionForm } from './actions'

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
      <ActionForm action={toggleOfferingSelectionForm} className="flex-1" successMessage="Saved">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_product_id" value={campaignProductId} />
        <input type="hidden" name="kind" value="shortlisted" />
        {shortlisted && !selected ? <input type="hidden" name="remove" value="1" /> : null}
        <SubmitButton
          pendingLabel="Saving…"
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold ${
            shortlisted && !selected
              ? 'border border-green-200 bg-green-50 text-green-700'
              : 'border border-gray-300 bg-white text-gray-700'
          }`}
        >
          {shortlisted && !selected ? 'Shortlisted' : 'Shortlist'}
        </SubmitButton>
      </ActionForm>
      <ActionForm action={toggleOfferingSelectionForm} className="flex-1" successMessage="Saved">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="campaign_product_id" value={campaignProductId} />
        <input type="hidden" name="kind" value="selected" />
        {selected ? <input type="hidden" name="remove" value="1" /> : null}
        <SubmitButton
          pendingLabel="Saving…"
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-lg px-3 text-xs font-semibold text-white ${
            selected ? 'bg-[#806A50]' : 'bg-[#806A50] hover:bg-[#9C8567]'
          }`}
        >
          {selected ? 'Selected' : 'Select'}
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
