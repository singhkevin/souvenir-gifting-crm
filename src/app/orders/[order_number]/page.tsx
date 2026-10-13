import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { paymentLabel } from '@/lib/orders/payment'
import { publicOrderTokenMatches } from '@/lib/orders/public-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Order status',
}

export default async function GuestOrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ order_number: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { order_number: orderNumber } = await params
  const { t: token } = await searchParams
  const admin = createAdminClient()
  if (!admin || !token) notFound()

  const { data: order } = await admin
    .from('orders')
    .select(`
      id, order_number, status, order_value, expected_delivery_date, dispatch_date, tracking_number, public_token_hash,
      courier_partner:courier_partners(name),
      items:order_items(id, description, quantity, product:products(name))
    `)
    .eq('order_number', orderNumber)
    .maybeSingle()

  if (!order || !publicOrderTokenMatches(token, order.public_token_hash)) notFound()

  const { data: invoice } = await admin
    .from('invoices')
    .select('status, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const courier = oneRelation(order.courier_partner)
  const items = order.items || []

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#806A50]">Order status</p>
      <h1 className="mt-2 font-serif text-3xl text-[#1C1917]">{order.order_number}</h1>
      <p className="mt-3 text-sm font-medium text-[#806A50]">
        {CLIENT_STATUS_LABELS[order.status] || order.status}
      </p>
      <p className="mt-1 text-sm text-[#5C6570]">Total {formatCurrency(order.order_value || 0)}</p>
      <dl className="mt-6 space-y-2 text-sm text-[#1C1917]">
        <div className="flex justify-between gap-4">
          <dt className="text-[#5C6570]">Invoice</dt>
          <dd>{paymentLabel(invoice?.status)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#5C6570]">Dispatch</dt>
          <dd>{order.dispatch_date ? formatDate(order.dispatch_date) : 'Not dispatched yet'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#5C6570]">Tracking</dt>
          <dd>{order.tracking_number ? `${courier?.name ? `${courier.name} · ` : ''}${order.tracking_number}` : 'Not available yet'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#5C6570]">Expected delivery</dt>
          <dd>{order.expected_delivery_date ? formatDate(order.expected_delivery_date) : '—'}</dd>
        </div>
      </dl>
      <ul className="mt-8 divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {items.map((item) => {
          const product = oneRelation(item.product)
          return (
            <li key={item.id} className="flex justify-between px-4 py-3 text-sm">
              <span>{product?.name || item.description || 'Item'}</span>
              <span className="text-[#5C6570]">× {item.quantity}</span>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
