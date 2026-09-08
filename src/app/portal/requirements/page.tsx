import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'

function statusClass(status: string | null) {
  if (status === 'new') return 'bg-blue-100 text-blue-800'
  if (status === 'quoting') return 'bg-yellow-100 text-yellow-800'
  if (status === 'fulfilled') return 'bg-green-100 text-green-800'
  return 'bg-gray-100 text-gray-800'
}

export default async function PortalRequirementsPage() {
  const supabase = await createClient()
  
  const { data: companyId } = await supabase.rpc('client_company_id')
  
  const { data: requirements } = await supabase
    .from('requirements')
    .select('*, requirement_items(id)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Requirements</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">Track and manage your gifting requirements.</p>
        </div>
        <Link 
          href="/portal/requirements/new"
          className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-4 text-sm font-semibold text-white hover:bg-[#274433] sm:w-auto"
        >
          Create New Requirement
        </Link>
      </div>

      {(!requirements || requirements.length === 0) ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          No requirements found. Create one to get started.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {requirements.map((req) => (
              <article key={req.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{req.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{req.purpose}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(req.status)}`}>
                    {String(req.status || '').replace('_', ' ').toUpperCase() || '—'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Budget/unit</p>
                    <p className="mt-0.5 font-medium text-gray-900">{formatCurrency(req.budget_per_unit)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Quantity</p>
                    <p className="mt-0.5 font-medium text-gray-900">{req.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Deadline</p>
                    <p className="mt-0.5 font-medium text-gray-900">
                      {req.deadline && !Number.isNaN(new Date(req.deadline).getTime())
                        ? format(new Date(req.deadline), 'MMM dd, yyyy')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-400">Created</p>
                    <p className="mt-0.5 font-medium text-gray-900">
                      {req.created_at && !Number.isNaN(new Date(req.created_at).getTime())
                        ? format(new Date(req.created_at), 'MMM dd, yyyy')
                        : '-'}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-900">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Name</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Budget/Unit</th>
                    <th className="px-6 py-4 font-semibold">Quantity</th>
                    <th className="px-6 py-4 font-semibold">Deadline</th>
                    <th className="px-6 py-4 font-semibold">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {requirements.map((req) => (
                    <tr key={req.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {req.name}
                        <div className="mt-1 text-xs font-normal text-gray-500">{req.purpose}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(req.status)}`}>
                          {String(req.status || '').replace('_', ' ').toUpperCase() || '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{formatCurrency(req.budget_per_unit)}</td>
                      <td className="px-6 py-4">{req.quantity}</td>
                      <td className="px-6 py-4">
                        {req.deadline && !Number.isNaN(new Date(req.deadline).getTime())
                          ? format(new Date(req.deadline), 'MMM dd, yyyy')
                          : '-'}
                      </td>
                      <td className="px-6 py-4">
                        {req.created_at && !Number.isNaN(new Date(req.created_at).getTime())
                          ? format(new Date(req.created_at), 'MMM dd, yyyy')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
