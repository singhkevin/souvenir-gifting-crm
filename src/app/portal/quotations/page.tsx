import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

function statusClass(status: string | null) {
  if (status === 'accepted') return 'bg-green-100 text-green-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  if (status === 'sent') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
}

export default async function PortalQuotationsPage() {
  const supabase = await createClient()

  const { data: companyId } = await supabase.rpc('client_company_id')

  // Explicit column list: internal notes, owner and margin fields must never reach a client.
  const { data: quotations } = companyId
    ? await supabase
        .from('quotations')
        .select('id, quotation_number, status, total, valid_until, created_at')
        .eq('company_id', companyId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Quotations</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Review and approve quotations for your requirements.</p>
      </div>

      {quotations?.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
          No quotations available.
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {quotations?.map((quote) => (
              <article key={quote.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-gray-900">{quote.quotation_number}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(quote.created_at)} · valid {formatDate(quote.valid_until)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusClass(quote.status)}`}>
                    {(quote.status || 'sent').toUpperCase()}
                  </span>
                </div>
                <p className="text-base font-semibold text-gray-900">{formatCurrency(quote.total)}</p>
                <Link
                  href={`/portal/quotations/${quote.id}`}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
                >
                  View details
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-900">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Quote #</th>
                    <th className="px-6 py-4 font-semibold">Date</th>
                    <th className="px-6 py-4 font-semibold">Valid Until</th>
                    <th className="px-6 py-4 font-semibold">Total Amount</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quotations?.map((quote) => (
                    <tr key={quote.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-6 py-4 font-mono font-medium text-gray-900">
                        {quote.quotation_number}
                      </td>
                      <td className="px-6 py-4">{formatDate(quote.created_at)}</td>
                      <td className="px-6 py-4">{formatDate(quote.valid_until)}</td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatCurrency(quote.total)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(quote.status)}`}>
                          {(quote.status || 'sent').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/portal/quotations/${quote.id}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
                        >
                          View details
                        </Link>
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
