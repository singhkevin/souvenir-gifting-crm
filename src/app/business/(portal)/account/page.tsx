import { requireBusiness } from '@/lib/business/session'

export const dynamic = 'force-dynamic'

export default async function BusinessAccountPage() {
  const { profile, company } = await requireBusiness()
  const isVerified = company?.business_verification === 'verified'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business account</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Account</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Your business details on file.</p>
      </div>

      <div className="border border-[#CCC5BD] bg-[#FCF9F2] divide-y divide-[#CCC5BD]">
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Contact Name</span>
          <span className="font-medium text-[#1C1C18]">{profile.full_name || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Work Email</span>
          <span className="text-[#1C1C18]">{profile.email}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Company</span>
          <span className="font-medium text-[#1C1C18]">{company?.name || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">GSTIN</span>
          <span className="sv2-mono-sm text-xs text-[#1C1C18]">{company?.gst_number || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Location</span>
          <span className="text-[#1C1C18]">{[company?.city, company?.state, company?.country].filter(Boolean).join(', ') || '—'}</span>
        </div>
        <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Verification</span>
          <div>
            <span
              className={`inline-block px-2 py-0.5 sv2-label text-[10px] border uppercase ${
                isVerified
                  ? 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                  : 'border-[#9E4300] bg-[#FFDBCC] text-[#783100]'
              }`}
            >
              {isVerified ? 'Approved' : 'Pending approval'}
            </span>
          </div>
        </div>
        {company?.notes ? (
          <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] p-3.5 text-sm">
            <span className="sv2-label text-[10px] text-[#7C766F]">Account Notes</span>
            <span className="text-xs text-[#4A4640]">{company.notes}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

