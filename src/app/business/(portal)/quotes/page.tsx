import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotesPage() {
  const { company, profile } = await requireBusiness()
  const companyId = company?.id || profile.company_id
  const supabase = await createClient()
  const { data } = companyId
    ? await supabase
        .from('quotations')
        .select('id, quotation_number, status, valid_until, total, created_at')
        .eq('company_id', companyId)
        .in('status', ['sent', 'viewed', 'accepted', 'rejected', 'expired'])
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Quotes</h1>
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {(data || []).map((row) => (
          <li key={row.id}>
            <Link href={`/business/quotes/${row.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block font-medium">{row.quotation_number}</span>
                <span className="text-xs text-[#5C6570]">Valid until {row.valid_until ? formatDate(row.valid_until) : '—'}</span>
              </span>
              <span className="text-right text-sm">
                <span className="block capitalize text-[#806A50]">{row.status}</span>
                <span className="text-xs text-[#5C6570]">{formatCurrency(row.total)}</span>
              </span>
            </Link>
          </li>
        ))}
        {!(data || []).length ? <li className="px-4 py-6 text-sm text-[#5C6570]">Quotes appear here after the team sends them.</li> : null}
      </ul>
    </div>
  )
}
