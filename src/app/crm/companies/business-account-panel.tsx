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
    <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] shadow-none overflow-hidden text-xs">
      <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">Business Account</h2>
          <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
            Business
          </span>
          {company.business_verification === 'verified' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
              Verified
            </span>
          ) : company.business_verification === 'rejected' || company.business_verification === 'blocked' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40 rounded-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
              {company.business_verification}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] border border-[#CCC5BD] text-[#4A4640] bg-[#F6F3EC] rounded-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7C766F]" />
              {company.business_verification || 'unverified'}
            </span>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <p>
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mr-2">GSTIN:</span>
          <span className="font-mono text-[#1C1B1A]">{company.gst_number || '—'}</span>
        </p>
        {company.notes ? <p className="whitespace-pre-wrap text-[#4A4640] leading-relaxed">{company.notes}</p> : null}
        {canAct ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {(['verified', 'rejected', 'blocked'] as const).map((verification) => (
              <ActionForm key={verification} action={setBusinessVerification}>
                <input type="hidden" name="company_id" value={company.id} />
                <input type="hidden" name="verification" value={verification} />
                <SubmitButton
                  pendingLabel="Saving…"
                  className={
                    verification === 'verified'
                      ? 'rounded-none border border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors shadow-none'
                      : 'rounded-none border border-[#BA1A1A]/40 text-[#BA1A1A] hover:bg-[#BA1A1A]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors shadow-none'
                  }
                >
                  {verification === 'blocked' ? 'Block' : verification === 'verified' ? 'Verify' : 'Reject'}
                </SubmitButton>
              </ActionForm>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
