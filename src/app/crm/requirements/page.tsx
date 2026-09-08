import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800'
}

import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type ReqCompany = { id: string; name: string }
type ReqOwner = { id: string; full_name: string | null }
type RequirementRow = {
  id: string
  title?: string | null
  name?: string | null
  budget?: number | null
  quantity?: number | null
  deadline?: string | null
  status?: string | null
  company?: ReqCompany | ReqCompany[] | null
  owner?: ReqOwner | ReqOwner[] | null
}

export default async function RequirementsPage(props: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams
  const statusFilter = searchParams.status || 'all'
  
  const supabase = await createClient()

  let query = supabase
    .from('requirements')
    .select('*, company:companies(id, name), owner:profiles(id, full_name)')
    .order('created_at', { ascending: false })
  query = applyOwnerScope(query, profile)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: requirements, error } = await query
  const requirementRows = asRows<RequirementRow>(requirements)

  const statuses = ['all', 'active', 'won', 'lost', 'closed']

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-primary)]">Requirements</h1>
        <button className="bg-[var(--color-primary)] text-white hover:text-white px-4 py-2 rounded-md hover:opacity-90">
          Add Requirement
        </button>
      </div>

      <div className="mb-6 md:hidden">
        <MobileFilterBar
          pathname="/crm/requirements"
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              emptyLabel: 'All',
              options: statuses.map((status) => ({
                value: status,
                label: status === 'all' ? 'All' : status,
              })),
            },
          ]}
        />
      </div>
      <div className="mb-6 hidden gap-2 border-b md:flex">
        {statuses.map(status => (
          <Link 
            key={status}
            href={`/crm/requirements?status=${status}`}
            className={`px-4 py-2 text-sm font-medium capitalize ${statusFilter === status ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {status}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Name</th>
              <th className="p-4 font-medium text-gray-500">Company</th>
              <th className="p-4 font-medium text-gray-500">Owner</th>
              <th className="p-4 font-medium text-gray-500">Budget</th>
              <th className="p-4 font-medium text-gray-500">Qty</th>
              <th className="p-4 font-medium text-gray-500">Deadline</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requirementRows.map((req: RequirementRow) => {
              const company = oneRelation(req.company)
              const owner = oneRelation(req.owner)
              return (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="p-4">
                  <Link href={`/crm/requirements/${req.id}`} className="text-blue-600 hover:underline font-medium">
                    {req.title || req.name}
                  </Link>
                </td>
                <td className="p-4">{company?.name || '-'}</td>
                <td className="p-4">{owner?.full_name || '-'}</td>
                <td className="p-4">{req.budget ? formatCurrency(req.budget) : '-'}</td>
                <td className="p-4">{req.quantity || '-'}</td>
                <td className="p-4">{req.deadline ? formatDate(req.deadline) : '-'}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status || ''] || 'bg-gray-100 text-gray-800'}`}>
                    {req.status || 'unknown'}
                  </span>
                </td>
              </tr>
              )
            })}
            {requirementRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">No requirements found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}