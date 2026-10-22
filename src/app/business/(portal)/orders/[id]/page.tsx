import Link from 'next/link'
import { notFound } from 'next/navigation'
import { businessOrderBelongsToCompany } from '@/lib/business/order-visibility'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { paymentLabel } from '@/lib/orders/payment'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { ProductThumb } from '@/components/ui/product-thumb'

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
  if (!order || !businessOrderBelongsToCompany(order, company?.id || profile.company_id)) notFound()
  const { data: invoice } = await supabase
    .from('invoices')
    .select('status, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: items } = await supabase
    .from('order_items')
    .select('id, quantity, unit_price, line_total, product:products(name, sku, image_url)')
    .eq('order_id', id)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/business/orders"
          className="inline-flex items-center gap-1.5 sv2-label text-[10px] text-[#7C766F] hover:text-[#9E4300] transition-colors"
        >
          ← Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Order</p>
            <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">{order.order_number}</h1>
          </div>
          <span className="inline-block px-3 py-1 sv2-label text-xs uppercase border border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640]">
            {CLIENT_STATUS_LABELS[order.status] || order.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#CCC5BD] bg-[#F6F3EC] divide-x divide-y sm:divide-y-0 divide-[#CCC5BD]">
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Order Date</p>
          <p className="mt-1 sv2-mono-sm text-sm text-[#1C1C18]">
            {formatDate(order.created_at)}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Order Value</p>
          <p className="mt-1 sv2-mono-sm text-sm text-[#1C1C18]">
            {formatCurrency(order.order_value)}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Invoice Status</p>
          <p className="mt-1 text-sm text-[#1C1C18]">
            {paymentLabel(invoice?.status)}
          </p>
        </div>
        <div className="p-3.5">
          <p className="sv2-label text-[10px] text-[#7C766F]">Fulfillment</p>
          <p className="mt-1 sv2-mono-sm text-xs text-[#1C1C18]">
            {order.dispatch_date ? `Dispatched ${formatDate(order.dispatch_date)}` : 'Not dispatched yet'}
          </p>
          <p className="sv2-mono-sm text-xs text-[#7C766F]">
            {order.tracking_number ? `Tracking: ${order.tracking_number}` : 'Tracking not available'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[540px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Item</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Quantity</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Unit Price</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Line Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(items || []).map((item) => {
              const product = oneRelation(item.product as { name?: string; sku?: string; image_url?: string | null } | null)
              return (
                <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <ProductThumb src={product?.image_url} alt={product?.name || 'Item'} />
                      <div className="min-w-0">
                        <p className="font-medium text-[#1C1C18]">{product?.name || 'Item'}</p>
                        {product?.sku ? (
                          <p className="sv2-mono-sm text-xs text-[#7C766F]">SKU: {product.sku}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {item.quantity}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right font-medium text-[#1C1C18]">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
