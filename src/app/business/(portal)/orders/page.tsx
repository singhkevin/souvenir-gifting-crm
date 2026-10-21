import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { newestInvoiceStatus, paymentLabel } from '@/lib/orders/payment'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessOrdersPage() {
  const { company, profile } = await requireBusiness()
  const companyId = company?.id || profile.company_id
  const supabase = await createClient()
  const { data } = companyId
    ? await supabase
        .from('orders')
        .select('id, order_number, status, order_value, created_at, quotation_id, tracking_number, dispatch_date, invoices(status, created_at)')
        .eq('company_id', companyId)
        .not('quotation_id', 'is', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-6">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business account</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Orders</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Orders created from an accepted business quote.</p>
      </div>

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[620px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Order Number</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Date</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Order Value</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Status</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Fulfillment & Invoice</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(data || []).map((row) => (
              <tr key={row.id} className="hover:bg-[#F6F3EC] transition-colors">
                <td className="p-3.5 sv2-mono-sm font-semibold text-[#1C1C18]">
                  {row.order_number}
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  {formatDate(row.created_at)}
                </td>
                <td className="p-3.5 sv2-mono-sm text-right font-medium text-[#1C1C18]">
                  {formatCurrency(row.order_value)}
                </td>
                <td className="p-3.5">
                  <span className="inline-block px-2 py-0.5 sv2-label text-[10px] border border-[#CCC5BD] bg-[#F6F3EC] uppercase text-[#4A4640]">
                    {CLIENT_STATUS_LABELS[row.status] || row.status}
                  </span>
                </td>
                <td className="p-3.5 sv2-mono-sm text-xs text-[#4A4640]">
                  <span className="block">
                    {row.tracking_number ? `Tracking: ${row.tracking_number}` : 'Tracking not available yet'}
                  </span>
                  <span className="text-[10px] text-[#7C766F]">
                    {paymentLabel(newestInvoiceStatus(row.invoices))}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <Link
                    href={`/business/orders/${row.id}`}
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
                  No quote orders yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
