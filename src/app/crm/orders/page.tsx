import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS } from '@/lib/order-workflow'
import { isOrderSource, ORDER_SOURCE_LABELS, ORDER_SOURCES } from '@/lib/orders/source'
import { isPaymentFilter, newestInvoiceStatus, PAYMENT_FILTER_LABELS, PAYMENT_FILTERS, paymentFilterKey, paymentLabel } from '@/lib/orders/payment'

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  procurement: 'bg-orange-100 text-orange-800',
  mockup: 'bg-amber-100 text-amber-800',
  client_approval: 'bg-indigo-100 text-indigo-800',
  production: 'bg-orange-100 text-orange-800',
  packaging_qc: 'bg-yellow-100 text-yellow-800',
  dispatched: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-primary)]">Orders</h1>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
          Orders could not be loaded. {error.message}
        </div>
      )}

      <div className="mb-6 md:hidden">
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
      <div className="mb-6 hidden gap-1 overflow-x-auto border-b pb-px md:flex">
        {statuses.map(status => (
          <Link 
            key={status}
            href={ordersHref(status, sourceFilter, paymentFilter)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium capitalize ${statusFilter === status ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {status === 'all' ? 'All' : (ORDER_STATUS_LABELS[status] || status)}
          </Link>
        ))}
      </div>
      <div className="mb-6 hidden flex-wrap gap-2 md:flex">
        <Link href={ordersHref(statusFilter, 'all', paymentFilter)} className={`rounded-full px-3 py-1 text-xs font-medium ${sourceFilter === 'all' ? 'bg-[#806A50] text-white' : 'bg-white text-gray-600 border'}`}>All sources</Link>
        {ORDER_SOURCES.map((source) => (
          <Link key={source} href={ordersHref(statusFilter, source, paymentFilter)} className={`rounded-full px-3 py-1 text-xs font-medium ${sourceFilter === source ? 'bg-[#806A50] text-white' : 'bg-white text-gray-600 border'}`}>
            {ORDER_SOURCE_LABELS[source]}
          </Link>
        ))}
        <span className="mx-1 text-gray-300">|</span>
        <Link href={ordersHref(statusFilter, sourceFilter, 'all')} className={`rounded-full px-3 py-1 text-xs font-medium ${paymentFilter === 'all' ? 'bg-[#1C1917] text-white' : 'bg-white text-gray-600 border'}`}>All payments</Link>
        {PAYMENT_FILTERS.map((payment) => (
          <Link key={payment} href={ordersHref(statusFilter, sourceFilter, payment)} className={`rounded-full px-3 py-1 text-xs font-medium ${paymentFilter === payment ? 'bg-[#1C1917] text-white' : 'bg-white text-gray-600 border'}`}>
            {PAYMENT_FILTER_LABELS[payment]}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Order #</th>
              <th className="p-4 font-medium text-gray-500">Company</th>
              <th className="p-4 font-medium text-gray-500">Source</th>
              <th className="p-4 font-medium text-gray-500">Payment</th>
              <th className="p-4 font-medium text-gray-500">Value</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
              <th className="p-4 font-medium text-gray-500">Expected Delivery</th>
              <th className="p-4 font-medium text-gray-500">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orderRows.map((order: OrderRow) => {
              const isOverdue = order.expected_delivery_date && order.expected_delivery_date < today && order.status !== 'delivered'
              const company = oneRelation(order.company)
              const owner = oneRelation(order.owner)

              return (
                <tr key={order.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                  <td className="p-4">
                    <Link href={`/crm/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">
                      {order.order_number || `ORD-${order.id.slice(0,6)}`}
                    </Link>
                  </td>
                  <td className="p-4">
                    {company?.name || '-'}
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#FAF7F2] text-[#624B32]">
                      {isOrderSource(order.source) ? ORDER_SOURCE_LABELS[order.source] : 'CRM'}
                    </span>
                  </td>
                  <td className="p-4 text-sm">{paymentLabel(invoiceByOrder.get(order.id))}</td>
                  <td className="p-4">{formatCurrency(order.order_value || 0)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {ORDER_STATUS_LABELS[order.status] || order.status || 'unknown'}
                    </span>
                    <div className="mt-2 max-w-[140px]">
                      <OrderLifecycleBar status={order.status} compact />
                    </div>
                  </td>
                  <td className={`p-4 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                    {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '-'}
                  </td>
                  <td className="p-4">{owner?.full_name || '-'}</td>
                </tr>
              )
            })}
            {orderRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}