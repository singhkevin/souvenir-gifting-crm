import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalApprovalQueue, type PortalQueueRow } from '@/components/portal/approval-queue'
import { PortalInviteForm } from '@/app/crm/companies/portal-invite-button'
import { isMissingSchemaError } from '@/lib/orders/line-lifecycle-server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function PortalPeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, portal_approval')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile || profile.role !== 'client_admin' || !profile.company_id) redirect('/portal')
  if (profile.portal_approval === 'pending') redirect('/portal/awaiting')
  if (profile.portal_approval === 'rejected') redirect('/login?error=portal')

  const admin = createAdminClient()
  let rows: PortalQueueRow[] = []
  let unavailable = !admin
  if (admin) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, email, role, portal_signup_source, created_at')
      .eq('company_id', profile.company_id)
      .in('role', ['client_admin', 'client_user'])
      .eq('portal_approval', 'pending')
      .order('created_at', { ascending: true })
    if (error && isMissingSchemaError(error)) unavailable = true
    else {
      rows = (data || []).map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        source: row.portal_signup_source,
        created_at: row.created_at,
      }))
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7C766F]">Company</p>
        <h1 className="font-[family-name:var(--font-newsreader)] text-3xl font-normal text-[#1C1B1A]">People waiting</h1>
        <p className="mt-2 text-sm text-[#4A4640]">Approve colleagues for this company portal. You cannot approve yourself.</p>
      </div>
      <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-4">
        <h2 className="mb-3 font-[family-name:var(--font-newsreader)] text-xl text-[#1C1B1A]">Invite a colleague</h2>
        <PortalInviteForm companyId={profile.company_id} />
      </div>
      <div className="overflow-hidden border border-[#CCC5BD] bg-[#FCF9F2]">
        {unavailable ? (
          <p className="p-6 text-xs text-[#7C766F]">Approval is not available yet.</p>
        ) : (
          <PortalApprovalQueue rows={rows} companyId={profile.company_id} />
        )}
      </div>
    </section>
  )
}
