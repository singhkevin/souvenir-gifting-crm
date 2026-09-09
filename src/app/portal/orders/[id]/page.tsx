import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { Truck } from 'lucide-react'
import { ProductImage } from '@/components/ui/product-image'
import { OrderLifecycleBar } from '@/components/orders/order-lifecycle'

export default async function PortalOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: companyId } = await supabase.rpc('client_company_id')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, order_value, expected_delivery_date, created_at, tracking_number, company_id, campaign_id, quotation_id,
      campaign:campaign_id(name, employee_quantity),
      courier_partner:courier_partners(name),
      quotation:quotations(quotation_number, total),
      items:order_items(id, description, quantity, unit_price, line_total, product:products(id, name, sku, image_url, status))
    `)
    .eq('id', id)
    .maybeSingle()

  if (!order || order.company_id !== companyId) {
    notFound()
  }

  const campaign = oneRelation(order.campaign)
  const courier = oneRelation(order.courier_partner)
  const quotation = oneRelation(order.quotation)
  const items = (order.items ?? []).map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
    product: oneRelation(item.product),
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/portal/orders" label="Back to Orders" />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-gray-500">{order.order_number}</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">
              {campaign?.name || 'My order'}
            </h1>
            {campaign?.employee_quantity && (
              <p className="text-xs text-gray-500 mt-1">{campaign.employee_quantity.toLocaleString('en-IN')} employees</p>
            )}
            <p className="text-sm mt-2 font-medium text-[#1A3022]">
              Current status: {CLIENT_STATUS_LABELS[order.status] || order.status}
            </p>
            {quotation?.quotation_number && (
              <p className="text-xs text-gray-500 mt-1">
                Quotation {quotation.quotation_number}
                {quotation.total != null ? ` · ${formatCurrency(quotation.total)}` : ''}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Order value</p>
            <p className="text-2xl font-bold text-[#1A3022]">{formatCurrency(order.order_value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Expected delivery: {formatDate(order.expected_delivery_date)}</p>
          </div>
        </div>

        <div className="p-6 border-b space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Timeline</h3>
          <OrderLifecycleBar status={order.status} variant="client" showActors={false} />
        </div>

        {order.tracking_number && (
          <div className="px-6 pb-4">
            <div className="bg-emerald-50 p-4 rounded-xl flex items-center gap-3 text-xs">
              <Truck size={16} />
              <div>
                Dispatched via {courier?.name || 'courier'} · AWB {order.tracking_number}
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          <h3 className="text-xs font-bold uppercase mb-3">Items</h3>
          <table className="w-full text-xs">
            <thead><tr className="text-left text-gray-500">
              <th className="py-2">Product</th><th>Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th>
            </tr></thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">No products on this order yet.</td>
                </tr>
              ) : (
                items.map((item) => {
                  const name = item.product?.name || item.description || 'Product'
                  const canOpen = Boolean(item.product?.id && item.product.status === 'active')
                  return (
                  <tr key={item.id} className="border-t">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <ProductImage src={item.product?.image_url} alt={name} size="xs" className="rounded" />
                        <div>
                          {canOpen ? (
                            <Link
                              href={`/portal/catalogue/product/${item.product!.id}`}
                              className="font-medium text-gray-900 hover:text-[#1A3022] hover:underline"
                            >
                              {name}
                            </Link>
                          ) : (
                            <p>{name}</p>
                          )}
                          {item.product?.sku ? <p className="font-mono text-[10px] text-gray-400">{item.product.sku}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td>{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.unit_price)}</td>
                    <td className="text-right">{formatCurrency(item.line_total ?? item.unit_price)}</td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
