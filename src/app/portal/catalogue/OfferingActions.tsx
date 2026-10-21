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
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-none px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
            shortlisted && !selected
              ? 'border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
              : 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:bg-[#F6F3EC]'
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
          className={`inline-flex min-h-10 w-full items-center justify-center rounded-none px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-colors ${
            selected
              ? 'border border-[#9E4300] bg-[#9E4300] hover:bg-[#783100]'
              : 'border border-[#1C1B1A] bg-[#1C1B1A] hover:bg-[#9E4300]'
          }`}
        >
          {selected ? 'Selected' : 'Select'}
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
