import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { paymentLabel } from '@/lib/orders/payment'
import { publicOrderTokenMatches } from '@/lib/orders/public-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import { SiteShell } from '@/components/site/site-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Order status',
}

const ORDER_STAGES = [
  { id: 'placed', label: 'Order Placed', desc: 'Order received & confirmed' },
  { id: 'packed', label: 'Packed & Sealed', desc: 'Packed and checked' },
  { id: 'dispatched', label: 'In Transit', desc: 'Handed to courier partner' },
  { id: 'out_for_delivery', label: 'Out for Delivery', desc: 'With local courier delivery team' },
  { id: 'delivered', label: 'Delivered', desc: 'Safely delivered to recipient' },
]

function getStageIndex(status: string): number {
  switch (status) {
    case 'delivered':
      return 4
    case 'dispatched':
      return 2
    case 'in_production':
    case 'procurement':
    case 'confirmed':
      return 1
    default:
      return 0
  }
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
      items:order_items(id, description, quantity, product:products(name, sku))
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
  const currentStageIndex = getStageIndex(order.status)

  return (
    <SiteShell>
      {/* Order Hero & Confirmation Strip */}
      <section className="border-b border-[#CCC5BD] bg-[#F6F3EC] py-10 sm:py-12 px-4 sm:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <div className="font-sans text-xs uppercase tracking-wider font-semibold text-[#9E4300] mb-2">
              Order Status
            </div>
            <h1 className="font-serif sv2-headline-lg text-3xl sm:text-4xl lg:text-5xl font-normal text-[#1C1C18]">
              Order {order.order_number}
            </h1>
            <p className="mt-2 sv2-body-lg text-[#4A4640] max-w-2xl">
              Your order has been received and is being prepared for dispatch.
            </p>
          </div>

          {/* Monospaced Metadata Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 border border-[#CCC5BD] bg-[#FCF9F2] divide-x divide-y md:divide-y-0 divide-[#CCC5BD]">
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase tracking-wider">ORDER NUMBER</span>
              <span className="sv2-mono-md font-bold text-[#1C1C18] mt-1">{order.order_number}</span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase tracking-wider">STATUS</span>
              <span className="sv2-mono-md font-semibold text-[#9E4300] mt-1">
                {CLIENT_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase tracking-wider">TOTAL AMOUNT</span>
              <span className="sv2-mono-lg font-bold text-[#1C1C18] mt-0.5">
                {formatCurrency(order.order_value || 0)}
              </span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase tracking-wider">INVOICE STATUS</span>
              <span className="sv2-mono-md text-[#1C1C18] mt-1">{paymentLabel(invoice?.status)}</span>
            </div>
            <div className="p-4 flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase tracking-wider">DISPATCH DATE</span>
              <span className="sv2-mono-md text-[#1C1C18] mt-1">
                {order.dispatch_date ? formatDate(order.dispatch_date) : 'Pending dispatch'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-16 py-12 space-y-12">
        {/* Section 01: Trajectory Stepper */}
        <section className="space-y-6">
          <div className="flex items-baseline gap-4 border-b border-[#CCC5BD] pb-4">
            <span className="sv2-section-numeral text-3xl font-light text-[#CCC5BD]">01</span>
            <div>
              <h2 className="font-serif sv2-headline-md font-normal text-[#1C1C18]">Delivery Progress</h2>
              <p className="sv2-body-sm text-[#7C766F]">Current shipment status and courier updates</p>
            </div>
          </div>

          <div className="border border-[#CCC5BD] bg-[#FCF9F2] p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
              {ORDER_STAGES.map((stage, idx) => {
                const isPassed = idx <= currentStageIndex
                const isCurrent = idx === currentStageIndex
                return (
                  <div key={stage.id} className="flex md:flex-col items-start gap-3">
                    <div
                      className={`w-7 h-7 flex items-center justify-center shrink-0 border ${
                        isCurrent
                          ? 'border-[#9E4300] bg-[#9E4300] text-white'
                          : isPassed
                            ? 'border-[#000000] bg-[#000000] text-white'
                            : 'border-[#CCC5BD] bg-[#F6F3EC] text-[#7C766F]'
                      }`}
                    >
                      {isPassed ? (
                        <span className="sv2-mono-sm text-xs font-bold">&check;</span>
                      ) : (
                        <span className="sv2-mono-sm text-[10px]">{idx + 1}</span>
                      )}
                    </div>
                    <div>
                      <div
                        className={`sv2-label text-[11px] ${
                          isCurrent ? 'text-[#9E4300] font-bold' : isPassed ? 'text-[#1C1C18]' : 'text-[#7C766F]'
                        }`}
                      >
                        {stage.label}
                      </div>
                      <div className="sv2-body-sm text-xs text-[#7C766F] mt-0.5">{stage.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Courier Card */}
          <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-[#CCC5BD] pb-4">
              <div>
                <span className="font-sans text-xs uppercase tracking-wider font-semibold text-[#7C766F] block">
                  Courier &amp; Tracking
                </span>
                <h3 className="font-serif text-xl font-normal text-[#1C1C18] mt-1">
                  {courier?.name || 'Courier to be assigned'}
                </h3>
                <p className="sv2-mono-sm text-xs text-[#4A4640] mt-0.5">
                  Tracking / AWB Number: <strong className="text-[#1C1C18]">{order.tracking_number || 'Awaiting assignment'}</strong>
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase block">Expected Delivery</span>
                <span className="sv2-mono-md font-bold text-[#1C1C18]">
                  {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'To be confirmed'}
                </span>
              </div>
            </div>
            <div className="sv2-mono-sm text-[11px] text-[#4A4640] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9E4300]" />
              <span>Tracking details will update once dispatched.</span>
            </div>
          </div>
        </section>

        {/* Section 02: Items Ordered */}
        <section className="space-y-6">
          <div className="flex items-baseline gap-4 border-b border-[#CCC5BD] pb-4">
            <span className="sv2-section-numeral text-3xl font-light text-[#CCC5BD]">02</span>
            <div>
              <h2 className="font-serif sv2-headline-md font-normal text-[#1C1C18]">Order Items</h2>
              <p className="sv2-body-sm text-[#7C766F]">Inventory units and packaging specifications</p>
            </div>
          </div>

          <div className="border border-[#CCC5BD] bg-[#FCF9F2]">
            <ul className="divide-y divide-[#CCC5BD]">
              {items.map((item) => {
                const product = oneRelation(item.product)
                return (
                  <li key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h4 className="font-serif text-lg font-normal text-[#1C1C18]">
                        {product?.name || item.description || 'Gift Item'}
                      </h4>
                      {product?.sku ? (
                        <p className="sv2-mono-sm text-xs text-[#7C766F] mt-0.5">SKU: {product.sku}</p>
                      ) : null}
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="sv2-mono-sm text-[10px] text-[#7C766F] uppercase block">Quantity</span>
                      <span className="sv2-mono-md font-bold text-[#1C1C18]">&times; {item.quantity}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* Back Link */}
        <div className="pt-4">
          <Link
            href="/catalogue"
            className="sv2-mono-sm text-[11px] uppercase tracking-wider text-[#9E4300] hover:underline inline-flex items-center gap-1"
          >
            &larr; Back to the catalogue
          </Link>
        </div>
      </div>
    </SiteShell>
  )
}
