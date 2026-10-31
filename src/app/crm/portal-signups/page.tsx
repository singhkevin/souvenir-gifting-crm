import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { PortalApprovalQueue, type PortalQueueRow } from '@/components/portal/approval-queue'
import { isMissingSchemaError } from '@/lib/orders/line-lifecycle-server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function PortalSignupsPage() {
  await requireStaff(['admin', 'sales'])
  const admin = createAdminClient()
  let rows: PortalQueueRow[] = []
  let unavailable = false
  if (admin) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, full_name, email, role, portal_signup_source, created_at, company:companies(name)')
      .in('role', ['client_admin', 'client_user'])
      .eq('portal_approval', 'pending')
      .order('created_at', { ascending: true })
    if (error && isMissingSchemaError(error)) unavailable = true
    else {
      rows = (data || []).map((row) => {
        const company = Array.isArray(row.company) ? row.company[0] : row.company
        return {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          role: row.role,
          source: row.portal_signup_source,
          company_name: company && typeof company === 'object' && 'name' in company ? String(company.name) : null,
          created_at: row.created_at,
        }
      })
    }
  } else {
    unavailable = true
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Customers</p>
        <h1 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal text-[#1C1B1A]">Portal sign-ups</h1>
        <p className="mt-1 text-xs text-[#4A4640]">
          People waiting for a company portal. Admin and sales can approve any company.{' '}
          <Link href="/crm/companies" className="font-semibold text-[#9E4300] hover:underline">Companies</Link>
        </p>
      </div>
      <div className="overflow-hidden border border-[#CCC5BD] bg-[#FCF9F2]">
        {unavailable ? (
          <p className="p-6 text-xs text-[#7C766F]">Apply the portal sign-up migration, then refresh this queue.</p>
        ) : (
          <PortalApprovalQueue rows={rows} />
        )}
      </div>
    </div>
  )
}
