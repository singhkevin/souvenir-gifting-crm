import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'

export default async function PortalOrdersPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, created_at, expected_delivery_date, order_value, status, tracking_number, campaign:campaign_id(name, employee_quantity)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Orders</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Track deliveries and the documents for each order.</p>
      </div>

      <div className="grid gap-4">
        {(orders || []).map((order) => {
          const campaign = Array.isArray(order.campaign) ? order.campaign[0] : order.campaign
          return (
            <Link
              key={order.id}
              href={`/portal/orders/${order.id}`}
              className="block rounded-2xl border bg-white p-4 transition-colors hover:border-[#806A50] sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-lg">{campaign?.name || order.order_number}</p>
                  <p className="mt-0.5 font-mono text-xs text-gray-500">{order.order_number}</p>
                  {campaign?.employee_quantity && (
                    <p className="mt-1 text-xs text-gray-500">{Number(campaign.employee_quantity).toLocaleString('en-IN')} employees</p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="font-semibold">{formatCurrency(order.order_value)}</p>
                  <p className="text-xs text-gray-500">Expected {formatDate(order.expected_delivery_date)}</p>
                  <p className="mt-1 text-xs font-medium text-[#806A50]">{CLIENT_STATUS_LABELS[order.status] || order.status}</p>
                  {order.tracking_number && (
                    <p className="mt-0.5 text-[11px] text-gray-500">AWB {order.tracking_number}</p>
                  )}
                </div>
              </div>
              <span className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-[#E5DFD5] bg-[#FAF7F2] px-3 text-xs font-semibold text-[#806A50] sm:ml-auto sm:mt-3 sm:w-auto">
                View order
              </span>
            </Link>
          )
        })}
        {(!orders || orders.length === 0) && (
          <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">No orders found.</div>
        )}
      </div>
      <OrderDocuments companyId={companyId} />
    </div>
  )
}

async function OrderDocuments({ companyId }: { companyId: string | null }) {
  const supabase = await createClient()
  const [{ data: invoices }, { data: mockups }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, status, due_date, invoice_date, order_id')
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('mockups')
      .select('id, file_name, storage_path, mime_type, created_at, status, order_id')
      .eq('status', 'shared')
      .order('created_at', { ascending: false }),
  ])

  return (
    <section className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
        <p className="mt-1 text-sm text-gray-500">Invoices and shared mockups. Open an order to see the documents filed on it.</p>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Invoices</h3>
        <ul className="divide-y">
          {(invoices || []).map((invoice) => (
            <li key={invoice.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono font-medium text-gray-900">{invoice.invoice_number}</p>
                <p className="text-xs text-gray-500">{formatDate(invoice.invoice_date)} · due {formatDate(invoice.due_date)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatCurrency(invoice.amount)}</span>
                <span className="text-xs capitalize text-gray-500">{invoice.status}</span>
                {invoice.order_id ? (
                  <Link href={`/portal/orders/${invoice.order_id}`} className="text-xs font-semibold text-[#806A50]">Order</Link>
                ) : null}
              </div>
            </li>
          ))}
          {(!invoices || invoices.length === 0) && (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No invoices yet.</li>
          )}
        </ul>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-white">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Shared mockups</h3>
        <ul className="divide-y">
          {(mockups || []).map((mockup) => {
            const href = mockup.storage_path && (mockup.storage_path.startsWith('http') || mockup.storage_path.startsWith('/'))
              ? mockup.storage_path
              : mockup.storage_path
            return (
              <li key={mockup.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-gray-900">{mockup.file_name}</p>
                  <p className="text-xs text-gray-500">{mockup.mime_type} · {formatDate(mockup.created_at)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {mockup.order_id ? (
                    <Link href={`/portal/orders/${mockup.order_id}`} className="text-xs font-semibold text-[#806A50]">Order</Link>
                  ) : null}
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#806A50]">Open</a>
                  ) : null}
                </div>
              </li>
            )
          })}
          {(!mockups || mockups.length === 0) && (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No mockups shared yet.</li>
          )}
        </ul>
      </div>
    </section>
  )
}
