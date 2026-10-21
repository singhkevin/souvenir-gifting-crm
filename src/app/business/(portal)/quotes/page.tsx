import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function quoteStatusChip(status: string) {
  switch (status) {
    case 'accepted':
      return 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
    case 'sent':
    case 'viewed':
      return 'border-[#9E4300] bg-[#FFDBCC] text-[#783100]'
    case 'rejected':
      return 'border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A]'
    case 'expired':
      return 'border-[#CCC5BD] bg-[#EBE8E1] text-[#7C766F]'
    default:
      return 'border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640]'
  }
}

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
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business account</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Quotes</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Quotations from our sales team for you to review.</p>
      </div>

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Quote Number</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Created</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Valid Until</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Total</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Status</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(data || []).map((row) => (
              <tr key={row.id} className="hover:bg-[#F6F3EC] transition-colors">
                <td className="p-3.5 sv2-mono-sm font-semibold text-[#1C1C18]">
                  {row.quotation_number}
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  {formatDate(row.created_at)}
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  {row.valid_until ? formatDate(row.valid_until) : '—'}
                </td>
                <td className="p-3.5 sv2-mono-sm text-right font-medium text-[#1C1C18]">
                  {formatCurrency(row.total)}
                </td>
                <td className="p-3.5">
                  <span className={`inline-block px-2 py-0.5 sv2-label text-[10px] border uppercase ${quoteStatusChip(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <Link
                    href={`/business/quotes/${row.id}`}
                    className="sv2-label text-[10px] text-[#9E4300] hover:underline"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {!(data || []).length ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-[#4A4640]">
                  Quotes appear here after the team sends them.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

