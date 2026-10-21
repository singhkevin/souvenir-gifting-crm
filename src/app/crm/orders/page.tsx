import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS } from '@/lib/order-workflow'
import { isOrderSource, ORDER_SOURCE_LABELS, ORDER_SOURCES } from '@/lib/orders/source'
import { isPaymentFilter, newestInvoiceStatus, PAYMENT_FILTER_LABELS, PAYMENT_FILTERS, paymentFilterKey, paymentLabel } from '@/lib/orders/payment'
import { requireStaff, applyOrderScope } from '@/lib/auth'
import { OrderLifecycleBar } from '@/components/orders/order-lifecycle'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type OrderCompany = { id: string; name: string }
type OrderOwner = { id: string; full_name: string | null }
type OrderRow = {
  id: string
  order_number: string | null
  order_value: number | null
  status: string
  source?: string | null
  expected_delivery_date: string | null
  company?: OrderCompany | OrderCompany[] | null
  owner?: OrderOwner | OrderOwner[] | null
}

function ordersHref(status: string, source: string, payment: string) {
  const params = new URLSearchParams()
  if (status && status !== 'all') params.set('status', status)
  if (source && source !== 'all') params.set('source', source)
  if (payment && payment !== 'all') params.set('payment', payment)
  const query = params.toString()
  return query ? `/crm/orders?${query}` : '/crm/orders'
}

function OrderStatusChip({ status }: { status: string }) {
  if (status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 font-mono text-[11px] uppercase text-[#3A4537]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> {ORDER_STATUS_LABELS[status] || status}
      </span>
    )
  }
  if (status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 px-2 py-0.5 font-mono text-[11px] uppercase text-[#BA1A1A]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> {ORDER_STATUS_LABELS[status] || status}
      </span>
    )
  }
  if (['procurement', 'mockup', 'client_approval', 'production', 'packaging_qc', 'dispatched'].includes(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 font-mono text-[11px] uppercase text-[#9E4300]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9E4300]" /> {ORDER_STATUS_LABELS[status] || status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] px-2 py-0.5 font-mono text-[11px] uppercase text-[#4A4640]">
      {ORDER_STATUS_LABELS[status] || status || 'unknown'}
    </span>
  )
}

export default async function OrdersPage(props: { searchParams: Promise<{ status?: string; source?: string; payment?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams
  const statusFilter = searchParams.status || 'all'
  const sourceFilter = isOrderSource(searchParams.source) ? searchParams.source : 'all'
  const paymentFilter = isPaymentFilter(searchParams.payment) ? searchParams.payment : 'all'
  
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select('*, company:companies(id, name), owner:profiles!orders_owner_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })
  query = applyOrderScope(query, profile)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }
  if (sourceFilter !== 'all') {
    query = query.eq('source', sourceFilter)
  }

  const { data: orders, error } = await query
  if (error) console.error('Orders list query failed', error.message)
  let orderRows = asRows<OrderRow>(orders)
  const invoiceByOrder = new Map<string, string | null>()
  if (orderRows.length > 0) {
    const { data: invoices } = await supabase
      .from('invoices')
      .select('order_id, status, created_at')
      .in('order_id', orderRows.map((order) => order.id))
    const grouped = new Map<string, { status?: string | null; created_at?: string | null }[]>()
    for (const invoice of invoices || []) {
      const orderId = String(invoice.order_id || '')
      if (!orderId) continue
      const list = grouped.get(orderId) || []
      list.push(invoice)
      grouped.set(orderId, list)
    }
    for (const order of orderRows) {
      invoiceByOrder.set(order.id, newestInvoiceStatus(grouped.get(order.id)))
    }
  }
  if (paymentFilter !== 'all') {
    orderRows = orderRows.filter((order) => paymentFilterKey(invoiceByOrder.get(order.id)) === paymentFilter)
  }

  const statuses = ['all', ...ORDER_LIFECYCLE, 'cancelled']
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
          Orders
        </h1>
      </div>

      {error && (
        <div className="rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 p-3 text-xs text-[#BA1A1A]">
          Orders could not be loaded. {error.message}
        </div>
      )}

      <div className="md:hidden">
        <MobileFilterBar
          pathname="/crm/orders"
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: statusFilter,
              emptyLabel: 'All',
              options: statuses.map((status) => ({
                value: status,
                label: status === 'all' ? 'All' : (ORDER_STATUS_LABELS[status] || status),
              })),
            },
            {
              key: 'source',
              label: 'Source',
              value: sourceFilter,
              emptyLabel: 'All',
              options: [
                { value: 'all', label: 'All' },
                ...ORDER_SOURCES.map((source) => ({ value: source, label: ORDER_SOURCE_LABELS[source] })),
              ],
            },
            {
              key: 'payment',
              label: 'Payment',
              value: paymentFilter,
              emptyLabel: 'All',
              options: [
                { value: 'all', label: 'All' },
                ...PAYMENT_FILTERS.map((payment) => ({ value: payment, label: PAYMENT_FILTER_LABELS[payment] })),
              ],
            },
          ]}
        />
      </div>

      <div className="hidden space-y-3 md:block">
        <div className="flex gap-1.5 overflow-x-auto border-b border-[#CCC5BD] pb-2">
          {statuses.map((status) => (
            <Link
              key={status}
              href={ordersHref(status, sourceFilter, paymentFilter)}
              className={`shrink-0 rounded-none px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                statusFilter === status
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              {status === 'all' ? 'All' : (ORDER_STATUS_LABELS[status] || status)}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href={ordersHref(statusFilter, 'all', paymentFilter)}
            className={`rounded-none px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              sourceFilter === 'all'
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            All sources
          </Link>
          {ORDER_SOURCES.map((source) => (
            <Link
              key={source}
              href={ordersHref(statusFilter, source, paymentFilter)}
              className={`rounded-none px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                sourceFilter === source
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              {ORDER_SOURCE_LABELS[source]}
            </Link>
          ))}
          <span className="mx-1 text-[#CCC5BD]">|</span>
          <Link
            href={ordersHref(statusFilter, sourceFilter, 'all')}
            className={`rounded-none px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              paymentFilter === 'all'
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            All payments
          </Link>
          {PAYMENT_FILTERS.map((payment) => (
            <Link
              key={payment}
              href={ordersHref(statusFilter, sourceFilter, payment)}
              className={`rounded-none px-2.5 py-0.5 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                paymentFilter === payment
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              {PAYMENT_FILTER_LABELS[payment]}
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop Orders Table */}
      <div className="hidden overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2] md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order #</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Source</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Payment</th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Value (₹)</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Expected Delivery</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {orderRows.map((order: OrderRow) => {
              const isOverdue = order.expected_delivery_date && order.expected_delivery_date < today && order.status !== 'delivered'
              const company = oneRelation(order.company)
              const owner = oneRelation(order.owner)

              return (
                <tr key={order.id} className={`transition-colors hover:bg-[#F6F3EC] ${isOverdue ? 'bg-[#BA1A1A]/5' : ''}`}>
                  <td className="px-3.5 py-2.5">
                    <Link
                      href={`/crm/orders/${order.id}`}
                      className="font-mono font-medium text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                    >
                      {order.order_number || `ORD-${order.id.slice(0, 6)}`}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 text-[#1C1B1A]">{company?.name || '—'}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-2 py-0.5 font-mono text-[10px] uppercase text-[#4A4640]">
                      {isOrderSource(order.source) ? ORDER_SOURCE_LABELS[order.source] : 'CRM'}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-xs text-[#4A4640]">{paymentLabel(invoiceByOrder.get(order.id))}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">
                    {formatCurrency(order.order_value || 0)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <OrderStatusChip status={order.status} />
                    <div className="mt-1.5 max-w-[140px]">
                      <OrderLifecycleBar status={order.status} compact />
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className={`font-mono ${isOverdue ? 'font-semibold text-[#BA1A1A]' : 'text-[#4A4640]'}`}>
                      {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[#4A4640]">{owner?.full_name || '—'}</td>
                </tr>
              )
            })}
            {orderRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-xs text-[#7C766F]">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {orderRows.length > 0 ? (
          orderRows.map((order: OrderRow) => {
            const isOverdue = order.expected_delivery_date && order.expected_delivery_date < today && order.status !== 'delivered'
            const company = oneRelation(order.company)
            const owner = oneRelation(order.owner)

            return (
              <article key={order.id} className="space-y-2 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/crm/orders/${order.id}`}
                    className="font-mono text-xs font-semibold text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    {order.order_number || `ORD-${order.id.slice(0, 6)}`}
                  </Link>
                  <OrderStatusChip status={order.status} />
                </div>

                <div className="font-mono text-sm font-semibold text-[#1C1B1A]">
                  {formatCurrency(order.order_value || 0)}
                </div>

                <div className="max-w-[160px]">
                  <OrderLifecycleBar status={order.status} compact />
                </div>

                <div className="space-y-1 border-t border-[#CCC5BD] pt-2 text-xs text-[#4A4640]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company: </span>
                    {company?.name || '—'}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Source: </span>
                    <span className="inline-flex items-center rounded-none border border-[#CCC5BD] px-1.5 py-0.5 font-mono text-[9px] uppercase text-[#4A4640]">
                      {isOrderSource(order.source) ? ORDER_SOURCE_LABELS[order.source] : 'CRM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Payment: </span>
                    {paymentLabel(invoiceByOrder.get(order.id))}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Delivery: </span>
                    <span className={`font-mono ${isOverdue ? 'font-semibold text-[#BA1A1A]' : ''}`}>
                      {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Owner: </span>
                    {owner?.full_name || '—'}
                  </div>
                </div>

                <div className="border-t border-[#CCC5BD] pt-2">
                  <Link
                    href={`/crm/orders/${order.id}`}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    View Order →
                  </Link>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center text-xs text-[#7C766F]">
            No orders found.
          </div>
        )}
      </div>
    </div>
  )
}
