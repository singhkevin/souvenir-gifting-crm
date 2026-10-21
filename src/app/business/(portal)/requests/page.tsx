import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessRequestsPage() {
  const { company, profile } = await requireBusiness()
  const companyId = company?.id || profile.company_id
  const supabase = await createClient()
  const { data, error } = companyId
    ? await supabase
        .from('requirements')
        .select('id, name, status, created_at, deadline')
        .eq('company_id', companyId)
        .eq('source', 'business_portal')
        .order('created_at', { ascending: false })
    : { data: [], error: null }

  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business account</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Requests</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Quote requests you have sent to our sales team.</p>
      </div>

      {error ? (
        <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-sm text-[#4A4640]">
          Quote requests appear after the business portal migrations are applied.
        </div>
      ) : null}

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Request</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Submitted</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Deadline</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Status</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(data || []).map((row) => (
              <tr key={row.id} className="hover:bg-[#F6F3EC] transition-colors">
                <td className="p-3.5 font-medium text-[#1C1C18]">
                  {row.name}
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  {formatDate(row.created_at)}
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  {row.deadline ? formatDate(row.deadline) : '—'}
                </td>
                <td className="p-3.5">
                  <span className="inline-block px-2 py-0.5 sv2-label text-[10px] border border-[#CCC5BD] bg-[#F6F3EC] uppercase text-[#4A4640]">
                    {row.status}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <Link
                    href={`/business/requests/${row.id}`}
                    className="sv2-label text-[10px] text-[#9E4300] hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {!error && !(data || []).length ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-sm text-[#4A4640]">
                  No quote requests yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
