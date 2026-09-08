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
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">My Orders</h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">Track only your organisation&apos;s campaigns and deliveries.</p>
      </div>

      <div className="grid gap-4">
        {(orders || []).map((order) => {
          const campaign = Array.isArray(order.campaign) ? order.campaign[0] : order.campaign
          return (
            <Link
              key={order.id}
              href={`/portal/orders/${order.id}`}
              className="block rounded-2xl border bg-white p-4 transition-colors hover:border-[#1A3022] sm:p-5"
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
                  <p className="mt-1 text-xs font-medium text-[#1A3022]">{CLIENT_STATUS_LABELS[order.status] || order.status}</p>
                  {order.tracking_number && (
                    <p className="mt-0.5 text-[11px] text-gray-500">AWB {order.tracking_number}</p>
                  )}
                </div>
              </div>
              <span className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg border border-[#E5DFD5] bg-[#FAF7F2] px-3 text-xs font-semibold text-[#1A3022] sm:ml-auto sm:mt-3 sm:w-auto">
                View order
              </span>
            </Link>
          )
        })}
        {(!orders || orders.length === 0) && (
          <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">No orders found.</div>
        )}
      </div>
    </div>
  )
}
