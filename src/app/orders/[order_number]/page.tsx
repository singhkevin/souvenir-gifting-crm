import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { CLIENT_LINE_STAGE_LABELS, CLIENT_ORDER_STEPS, clientOrderStepIndex } from '@/lib/orders/line-lifecycle'
import { paymentLabel } from '@/lib/orders/payment'
import { publicOrderTokenMatches } from '@/lib/orders/public-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import { SiteShell } from '@/components/site/site-shell'
import { ProductThumb } from '@/components/ui/product-thumb'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Order status',
}

/** Hero line for each step, so the page never says "being prepared" after delivery. */
function heroText(status: string, stepIndex: number) {
  if (status === 'cancelled') return 'This order has been cancelled. Contact us if this is unexpected.'
  if (status === 'partly_delivered') return 'Part of your order has been delivered. The rest is on its way.'
  switch (stepIndex) {
    case 0:
      return 'Your order has been received and confirmed.'
    case 1:
      return 'Your order is being prepared.'
    case 2:
      return 'Your order is packed and ready to leave.'
    case 3:
      return 'Your order is on its way.'
    default:
      return 'Your order has been delivered.'
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
      items:order_items(id, description, quantity, product:products(name, sku, image_url))
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
  const cancelled = order.status === 'cancelled'
  const currentStageIndex = clientOrderStepIndex(order.status)

  // Per-line progress exists only after the line-lifecycle migration; before it this query
  // fails and the page shows the order-level steps alone.
  const lineProgress = new Map<string, { stage: string | null; delivered: number }>()
  {
    const { data: lines, error: linesError } = await admin
      .from('order_items')
      .select('id, stage, qty_delivered')
      .eq('order_id', order.id)
    if (!linesError) {
      for (const line of (lines || []) as { id: string; stage: string | null; qty_delivered: number | null }[]) {
        lineProgress.set(line.id, { stage: line.stage, delivered: Number(line.qty_delivered || 0) })
      }
    }
  }
  const showLineStages =
    lineProgress.size > 0 && new Set(Array.from(lineProgress.values()).map((l) => l.stage)).size > 1

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
              {heroText(order.status, currentStageIndex)}
            </p>
          </div>

          {/* Monospaced Metadata Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 border border-[#CCC5BD] bg-[#FCF9F2] divide-x divide-y md:divide-y-0 divide-[#CCC5BD]">
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-label text-[10px] text-[#7C766F]">ORDER NUMBER</span>
              <span className="sv2-mono-md font-bold text-[#1C1C18] mt-1">{order.order_number}</span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-label text-[10px] text-[#7C766F]">STATUS</span>
              <span className="sv2-mono-md font-semibold text-[#9E4300] mt-1">
                {CLIENT_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-label text-[10px] text-[#7C766F]">TOTAL AMOUNT</span>
              <span className="sv2-mono-lg font-bold text-[#1C1C18] mt-0.5">
                {formatCurrency(order.order_value || 0)}
              </span>
            </div>
            <div className="p-4 flex flex-col justify-between">
              <span className="sv2-label text-[10px] text-[#7C766F]">INVOICE STATUS</span>
              <span className="sv2-mono-md text-[#1C1C18] mt-1">{paymentLabel(invoice?.status)}</span>
            </div>
            <div className="p-4 flex flex-col justify-between col-span-2 md:col-span-1">
              <span className="sv2-label text-[10px] text-[#7C766F]">DISPATCH DATE</span>
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
              {CLIENT_ORDER_STEPS.map((stage, idx) => {
                const isPassed = !cancelled && idx <= currentStageIndex
                const isCurrent = !cancelled && idx === currentStageIndex
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
            {cancelled ? (
              <p className="mt-6 border-t border-[#CCC5BD] pt-4 sv2-body-sm text-[#9E4300]">This order was cancelled.</p>
            ) : null}
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
                <span className="sv2-label text-[10px] text-[#7C766F] block">Expected Delivery</span>
                <span className="sv2-mono-md font-bold text-[#1C1C18]">
                  {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'To be confirmed'}
                </span>
              </div>
            </div>
            <div className="sv2-mono-sm text-[11px] text-[#4A4640] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9E4300]" />
              <span>
                {currentStageIndex >= 3
                  ? 'Dispatched. Use the tracking number above with the courier.'
                  : 'Tracking details will update once dispatched.'}
              </span>
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
                    <div className="flex items-center gap-3">
                      <ProductThumb src={product?.image_url} alt={product?.name || item.description || 'Gift Item'} size={48} />
                      <div className="min-w-0">
                        <h4 className="font-serif text-lg font-normal text-[#1C1C18]">
                          {product?.name || item.description || 'Gift Item'}
                        </h4>
                        {product?.sku ? (
                          <p className="sv2-mono-sm text-xs text-[#7C766F] mt-0.5">SKU: {product.sku}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="sv2-label text-[10px] text-[#7C766F] block">Quantity</span>
                      <span className="sv2-mono-md font-bold text-[#1C1C18]">&times; {item.quantity}</span>
                      {showLineStages && lineProgress.get(item.id)?.stage ? (
                        <span className="sv2-mono-sm block text-[11px] text-[#9E4300] mt-1">
                          {CLIENT_LINE_STAGE_LABELS[lineProgress.get(item.id)!.stage!] || lineProgress.get(item.id)!.stage}
                          {lineProgress.get(item.id)!.delivered > 0 && lineProgress.get(item.id)!.delivered < Number(item.quantity || 0)
                            ? ` · ${lineProgress.get(item.id)!.delivered} of ${item.quantity} delivered`
                            : ''}
                        </span>
                      ) : null}
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
            className="sv2-label text-[11px] text-[#9E4300] hover:underline inline-flex items-center gap-1"
          >
            &larr; Back to the catalogue
          </Link>
        </div>
      </div>
    </SiteShell>
  )
}
