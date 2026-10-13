import { requireBusiness } from '@/lib/business/session'

export const dynamic = 'force-dynamic'

export default async function BusinessAccountPage() {
  const { profile, company } = await requireBusiness()
  return (
    <div className="max-w-xl space-y-3">
      <h1 className="font-serif text-3xl">Account</h1>
      <p className="text-sm"><span className="text-[#5C6570]">Name.</span> {profile.full_name || '—'}</p>
      <p className="text-sm"><span className="text-[#5C6570]">Email.</span> {profile.email}</p>
      <p className="text-sm"><span className="text-[#5C6570]">Company.</span> {company?.name || '—'}</p>
      <p className="text-sm"><span className="text-[#5C6570]">GSTIN.</span> {company?.gst_number || '—'}</p>
      <p className="text-sm"><span className="text-[#5C6570]">City.</span> {[company?.city, company?.state, company?.country].filter(Boolean).join(', ') || '—'}</p>
      <p className="text-sm">
        <span className="text-[#5C6570]">Verification.</span>{' '}
        {company?.business_verification === 'verified' ? 'Approved' : 'Pending approval'}
      </p>
      {company?.notes ? <p className="text-sm text-[#5C6570]">{company.notes}</p> : null}
    </div>
  )
}
