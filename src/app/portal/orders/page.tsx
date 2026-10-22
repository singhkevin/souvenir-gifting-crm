import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { newestInvoiceStatus, paymentLabel } from '@/lib/orders/payment'

function OrderStatusChip({ status }: { status: string }) {
  const label = CLIENT_STATUS_LABELS[status] || status
  if (['delivered', 'fulfilled'].includes(status)) {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  if (['cancelled', 'rejected'].includes(status)) {
    return (
      <span className="inline-block border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  if (['client_approval', 'production', 'mockup', 'dispatch'].includes(status)) {
    return (
      <span className="inline-block border border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#1C1C18] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
      {label}
    </span>
  )
}

function InvoiceStatusChip({ status }: { status: string | null }) {
  if (status === 'paid') {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        Paid
      </span>
    )
  }
  if (status === 'overdue') {
    return (
      <span className="inline-block border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        Overdue
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#4A4640] px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-none capitalize">
      {status || 'Issued'}
    </span>
  )
}

export default async function PortalOrdersPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, created_at, expected_delivery_date, order_value, status, tracking_number, dispatch_date, campaign:campaign_id(name, employee_quantity), invoices(status, created_at)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-10 min-w-0">
      {/* Page Header */}
      <div className="border-b border-[#CCC5BD] pb-6">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
          Client portal · Orders
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C18] tracking-tight">Orders</h1>
        <p className="mt-2 text-sm text-[#4A4640]">Track deliveries and the documents for each order.</p>
      </div>

      {/* Orders List / Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            Active & Past Orders ({orders?.length || 0})
          </span>
        </div>

        {(!orders || orders.length === 0) ? (
          <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-8 text-center text-sm text-[#7C766F] rounded-none">
            No orders found.
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table */}
            <div className="hidden sm:block border border-[#CCC5BD] bg-white rounded-none overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4">Expected Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Order Value</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#CCC5BD] text-sm">
                  {orders.map((order) => {
                    const campaign = Array.isArray(order.campaign) ? order.campaign[0] : order.campaign
                    const invoiceStatus = newestInvoiceStatus(order.invoices)
                    return (
                      <tr key={order.id} className="hover:bg-[#F6F3EC] transition-colors">
                        <td className="py-4 px-4 font-mono text-xs text-[#1C1C18] font-medium whitespace-nowrap">
                          {order.order_number}
                          {order.tracking_number && (
                            <span className="block text-[10px] text-[#7C766F] mt-0.5">
                              AWB: {order.tracking_number}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-[#1C1C18]">{campaign?.name || order.order_number}</p>
                          {campaign?.employee_quantity && (
                            <p className="text-xs text-[#7C766F] mt-0.5">
                              {Number(campaign.employee_quantity).toLocaleString('en-IN')} recipients
                            </p>
                          )}
                          <p className="text-[11px] text-[#7C766F] mt-0.5">
                            {paymentLabel(invoiceStatus)}
                          </p>
                        </td>
                        <td className="py-4 px-4 font-mono text-xs text-[#4A4640] whitespace-nowrap">
                          {formatDate(order.expected_delivery_date)}
                        </td>
                        <td className="py-4 px-4 whitespace-nowrap">
                          <OrderStatusChip status={order.status} />
                        </td>
                        <td className="py-4 px-4 text-right font-mono text-sm font-semibold text-[#1C1C18] whitespace-nowrap">
                          {formatCurrency(order.order_value)}
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/portal/orders/${order.id}`}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300] transition-colors rounded-none"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked List */}
            <div className="sm:hidden border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
              {orders.map((order) => {
                const campaign = Array.isArray(order.campaign) ? order.campaign[0] : order.campaign
                const invoiceStatus = newestInvoiceStatus(order.invoices)
                return (
                  <div key={order.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-semibold text-[#1C1C18] block">
                          {order.order_number}
                        </span>
                        <p className="font-serif text-lg text-[#1C1C18] mt-1">
                          {campaign?.name || order.order_number}
                        </p>
                      </div>
                      <OrderStatusChip status={order.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#CCC5BD]">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">
                          Expected
                        </span>
                        <span className="font-mono text-xs text-[#4A4640]">
                          {formatDate(order.expected_delivery_date)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">
                          Value
                        </span>
                        <span className="font-mono text-sm font-semibold text-[#1C1C18]">
                          {formatCurrency(order.order_value)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#7C766F] space-y-0.5">
                      {campaign?.employee_quantity && (
                        <p>{Number(campaign.employee_quantity).toLocaleString('en-IN')} recipients</p>
                      )}
                      {order.tracking_number && <p className="font-mono">AWB: {order.tracking_number}</p>}
                      <p>{paymentLabel(invoiceStatus)}</p>
                    </div>

                    <Link
                      href={`/portal/orders/${order.id}`}
                      className="inline-flex w-full items-center justify-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300] transition-colors rounded-none"
                    >
                      View order
                    </Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Documents Section */}
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
    <section className="space-y-6 pt-6 border-t border-[#CCC5BD]">
      <div>
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
          Records
        </span>
        <h2 className="font-serif text-2xl text-[#1C1C18] tracking-tight">Documents</h2>
        <p className="mt-1 text-sm text-[#4A4640]">Invoices and shared mockups. Open an order to see the documents filed on it.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices Box */}
        <div className="border border-[#CCC5BD] bg-white rounded-none">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1C18]">Invoices</h3>
            <span className="font-mono text-xs text-[#7C766F]">Count: {(invoices || []).length}</span>
          </div>
          <ul className="divide-y divide-[#CCC5BD]">
            {(invoices || []).map((invoice) => (
              <li key={invoice.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm hover:bg-[#F6F3EC] transition-colors">
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-[#1C1C18]">{invoice.invoice_number}</p>
                  <p className="font-mono text-xs text-[#7C766F]">
                    {formatDate(invoice.invoice_date)} · due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(invoice.amount)}</span>
                  <InvoiceStatusChip status={invoice.status} />
                  {invoice.order_id ? (
                    <Link
                      href={`/portal/orders/${invoice.order_id}`}
                      className="font-mono text-xs text-[#9E4300] hover:underline font-medium"
                    >
                      Order →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
            {(!invoices || invoices.length === 0) && (
              <li className="px-4 py-8 text-center text-xs text-[#7C766F] bg-[#FCF9F2]">No invoices yet.</li>
            )}
          </ul>
        </div>

        {/* Shared mockups Box */}
        <div className="border border-[#CCC5BD] bg-white rounded-none">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-3 flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1C18]">Shared mockups</h3>
            <span className="font-mono text-xs text-[#7C766F]">Count: {(mockups || []).length}</span>
          </div>
          <ul className="divide-y divide-[#CCC5BD]">
            {(mockups || []).map((mockup) => {
              const href = mockup.storage_path && (mockup.storage_path.startsWith('http') || mockup.storage_path.startsWith('/'))
                ? mockup.storage_path
                : mockup.storage_path
              return (
                <li key={mockup.id} className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm hover:bg-[#F6F3EC] transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1C1C18] truncate">{mockup.file_name}</p>
                    <p className="font-mono text-xs text-[#7C766F]">
                      {mockup.mime_type} · {formatDate(mockup.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {mockup.order_id ? (
                      <Link
                        href={`/portal/orders/${mockup.order_id}`}
                        className="font-mono text-xs text-[#9E4300] hover:underline font-medium"
                      >
                        Order →
                      </Link>
                    ) : null}
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:bg-[#1C1B1A] hover:text-white transition-colors rounded-none"
                      >
                        Open
                      </a>
                    ) : null}
                  </div>
                </li>
              )
            })}
            {(!mockups || mockups.length === 0) && (
              <li className="px-4 py-8 text-center text-xs text-[#7C766F] bg-[#FCF9F2]">No mockups shared yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
