import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { isGiftStaffRole } from '@/lib/roles'
import { formatDateTime } from '@/lib/utils'
import { giftWindowOpen } from '@/lib/gifts/rules'

export const dynamic = 'force-dynamic'

type Row = {
  id: string
  name: string
  opens_at: string
  closes_at: string
  company: { name: string } | { name: string }[] | null
}

export default async function GiftSelectionsPage() {
  const profile = await requireStaff()
  if (!isGiftStaffRole(profile.role)) {
    return <p className="text-sm text-red-700">You do not have access to gift selection.</p>
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gift_selections')
    .select('id, name, opens_at, closes_at, company:companies(name)')
    .order('created_at', { ascending: false })

  const rows = (data || []) as Row[]
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">Gift selection</h1>
          <p className="mt-1 text-sm text-gray-500">Employees on the company portal choose one shortlisted gift.</p>
        </div>
        <Link href="/crm/gift-selections/new" className="bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
          New gift selection
        </Link>
      </div>
      {error ? (
        <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Gift selection tables are not available yet. Apply the migration, then refresh.
        </p>
      ) : null}
      <div className="overflow-hidden border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No gift selections yet.</td>
              </tr>
            ) : rows.map((row) => {
              const company = Array.isArray(row.company) ? row.company[0] : row.company
              const open = giftWindowOpen(row.opens_at, row.closes_at)
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <Link href={`/crm/gift-selections/${row.id}`} className="font-medium text-[var(--color-primary)]">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{company?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDateTime(row.opens_at)} – {formatDateTime(row.closes_at)}
                  </td>
                  <td className="px-4 py-3">{open ? 'Open' : 'Closed'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
