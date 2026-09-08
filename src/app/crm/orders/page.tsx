import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate, asRows, oneRelation } from '@/lib/utils'

const STATUS_COLORS: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  procurement: 'bg-orange-100 text-orange-800',
  printing: 'bg-amber-100 text-amber-800',
  quality_check: 'bg-yellow-100 text-yellow-800',
  ready_to_dispatch: 'bg-teal-100 text-teal-800',
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
  expected_delivery_date: string | null
  company?: OrderCompany | OrderCompany[] | null
  owner?: OrderOwner | OrderOwner[] | null
}

export default async function OrdersPage(props: { searchParams: Promise<{ status?: string }> }) {
  const profile = await requireStaff()
  const searchParams = await props.searchParams
  const statusFilter = searchParams.status || 'all'
  
  const supabase = await createClient()

  let query = supabase
    .from('orders')
    .select('*, company:companies(id, name), owner:profiles!orders_owner_id_fkey(id, full_name)')
    .order('created_at', { ascending: false })
  query = applyOrderScope(query, profile)

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data: orders, error } = await query
  if (error) console.error('Orders list query failed', error.message)
  const orderRows = asRows<OrderRow>(orders)

  const statuses = ['all', 'created', 'confirmed', 'procurement', 'printing', 'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered']

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
                label: status === 'all' ? 'All' : status.replace(/_/g, ' '),
              })),
            },
          ]}
        />
      </div>
      <div className="mb-6 hidden gap-1 overflow-x-auto border-b pb-px md:flex">
        {statuses.map(status => (
          <Link 
            key={status}
            href={`/crm/orders?status=${status}`}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium capitalize ${statusFilter === status ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {status.replace('_', ' ')}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Order #</th>
              <th className="p-4 font-medium text-gray-500">Company</th>
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
                  <td className="p-4">{formatCurrency(order.order_value || 0)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {(order.status || 'unknown').replace('_', ' ')}
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
                <td colSpan={6} className="p-8 text-center text-gray-500">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}