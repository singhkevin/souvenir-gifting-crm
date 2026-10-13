import { setBusinessVerification } from './business-actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export function BusinessAccountPanel({
  company,
  canAct,
}: {
  company: {
    id: string
    account_type?: string | null
    business_verification?: string | null
    gst_number?: string | null
    notes?: string | null
  }
  canAct: boolean
}) {
  if (company.account_type !== 'business') return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold text-sm text-gray-900">Business account</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Business
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize text-[10px] font-semibold text-gray-700">
          {company.business_verification || 'unverified'}
        </span>
      </div>
      <p><span className="font-semibold text-gray-500">GSTIN:</span> {company.gst_number || '—'}</p>
      {company.notes ? <p className="whitespace-pre-wrap text-gray-600">{company.notes}</p> : null}
      {canAct ? (
        <div className="flex flex-wrap gap-2">
          {(['verified', 'rejected', 'blocked'] as const).map((verification) => (
            <ActionForm key={verification} action={setBusinessVerification}>
              <input type="hidden" name="company_id" value={company.id} />
              <input type="hidden" name="verification" value={verification} />
              <SubmitButton
                pendingLabel="Saving…"
                className="rounded-lg border px-3 py-1.5 text-[11px] font-semibold capitalize"
              >
                {verification === 'blocked' ? 'Block' : verification === 'verified' ? 'Verify' : 'Reject'}
              </SubmitButton>
            </ActionForm>
          ))}
        </div>
      ) : null}
    </div>
  )
}
