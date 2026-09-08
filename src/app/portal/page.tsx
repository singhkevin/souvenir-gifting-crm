import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const [{ data: orders }, { data: quotes }, { data: campaigns }] = await Promise.all([
    supabase.from('orders').select('id, order_number, status, order_value, campaign:campaign_id(name)').eq('company_id', companyId).order('created_at', { ascending: false }).limit(6),
    supabase.from('quotations').select('id, quotation_number, status, total').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
    supabase.from('campaigns').select('id, name, total_budget, employee_quantity').eq('company_id', companyId).limit(5),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">Your campaigns, quotations, and live order status.</p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border bg-white p-3 sm:p-4"><p className="text-[10px] text-gray-500 sm:text-xs">Campaigns</p><p className="text-xl font-semibold sm:text-2xl">{campaigns?.length || 0}</p></div>
        <div className="rounded-2xl border bg-white p-3 sm:p-4"><p className="text-[10px] text-gray-500 sm:text-xs">Open quotations</p><p className="text-xl font-semibold sm:text-2xl">{quotes?.length || 0}</p></div>
        <div className="rounded-2xl border bg-white p-3 sm:p-4"><p className="text-[10px] text-gray-500 sm:text-xs">Orders</p><p className="text-xl font-semibold sm:text-2xl">{orders?.length || 0}</p></div>
      </div>
      <div className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-lg">My orders</h2>
          <Link
            href="/portal/orders"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
          >
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {(orders || []).map((o) => {
            const campaign = Array.isArray(o.campaign) ? o.campaign[0] : o.campaign
            return (
              <Link
                key={o.id}
                href={`/portal/orders/${o.id}`}
                className="flex flex-col gap-1 rounded-xl border border-[#EFE9E0] bg-[#FAF7F2] px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-gray-900">{campaign?.name || o.order_number}</span>
                <span className="text-xs text-gray-500 sm:text-sm">
                  {CLIENT_STATUS_LABELS[o.status] || o.status} · {formatCurrency(o.order_value)}
                </span>
              </Link>
            )
          })}
          {(!orders || orders.length === 0) && (
            <p className="py-4 text-center text-sm text-gray-500">No orders yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
