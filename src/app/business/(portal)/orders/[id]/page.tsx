import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { paymentLabel } from '@/lib/orders/payment'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { company, profile } = await requireBusiness()
  const supabase = await createClient()
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, order_value, created_at, quotation_id, company_id, tracking_number, dispatch_date')
    .eq('id', id)
    .maybeSingle()
  if (!order || !order.quotation_id || order.company_id !== (company?.id || profile.company_id)) notFound()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: items } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, line_total, product:products(name, sku)')
    .eq('order_id', id)

  return (
    <div className="space-y-6">
      <Link href="/business/orders" className="text-xs uppercase tracking-[0.14em] text-[#806A50]">Orders</Link>
      <div>
        <h1 className="font-serif text-3xl">{order.order_number}</h1>
        <p className="mt-2 text-sm text-[#5C6570]">
          {CLIENT_STATUS_LABELS[order.status] || order.status} · {formatDate(order.created_at)} · {formatCurrency(order.order_value)}
        </p>
        <p className="mt-1 text-sm text-[#5C6570]">
          Invoice: {paymentLabel(invoice?.status)}
          {' · '}
          {order.dispatch_date ? `Dispatched ${formatDate(order.dispatch_date)}` : 'Not dispatched yet'}
          {' · '}
          {order.tracking_number ? `Tracking ${order.tracking_number}` : 'Tracking not available yet'}
        </p>
      </div>
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {(items || []).map((item) => {
          const product = oneRelation(item.product as { name?: string; sku?: string } | null)
          return (
            <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">{product?.name || 'Item'}</span>
                <span className="text-xs text-[#5C6570]">{product?.sku} · {item.quantity} × {formatCurrency(item.unit_price)}</span>
              </span>
              <span>{formatCurrency(item.line_total)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
