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
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Requests</h1>
      {error ? <p className="text-sm text-[#5C6570]">Quote requests appear after the business portal migrations are applied.</p> : null}
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {(data || []).map((row) => (
          <li key={row.id}>
            <Link href={`/business/requests/${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block font-medium">{row.name}</span>
                <span className="text-xs text-[#5C6570]">{formatDate(row.created_at)}</span>
              </span>
              <span className="text-xs capitalize text-[#806A50]">{row.status}</span>
            </Link>
          </li>
        ))}
        {!error && !(data || []).length ? <li className="px-4 py-6 text-sm text-[#5C6570]">No quote requests yet.</li> : null}
      </ul>
    </div>
  )
}
