import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { Truck } from 'lucide-react'
import { ProductImage } from '@/components/ui/product-image'
import { OrderLifecycleBar } from '@/components/orders/order-lifecycle'
import { decideOrderApproval } from '../actions'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

function fileHref(path: string | null) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path
  return path
}

export default async function PortalOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ approval_error?: string }>
}) {
  const { id } = await params
  const { approval_error: approvalError } = await searchParams
  if (!isUuid(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: companyId } = await supabase.rpc('client_company_id')

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, order_number, status, order_value, expected_delivery_date, created_at, tracking_number, company_id, campaign_id, quotation_id, requirement_id,
      client_approval_status, client_approval_note, client_approval_at,
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

  const requirementId = isUuid(order.requirement_id) ? order.requirement_id : null
  let mockupQuery = supabase
    .from('mockups')
    .select('id, file_name, storage_path, mime_type, created_at')
    .eq('status', 'shared')
    .order('created_at', { ascending: false })
    .limit(20)
  mockupQuery = requirementId
    ? mockupQuery.or(`order_id.eq.${id},requirement_id.eq.${requirementId}`)
    : mockupQuery.eq('order_id', id)
  const { data: mockups } = await mockupQuery
  const showMockups = (mockups || []).length > 0 || order.status === 'mockup' || order.status === 'client_approval'

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
      {approvalError && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{approvalError}</p>
      )}

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
            <p className="text-sm mt-2 font-medium text-[#806A50]">
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
            <p className="text-2xl font-bold text-[#806A50]">{formatCurrency(order.order_value)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Expected delivery: {formatDate(order.expected_delivery_date)}</p>
          </div>
        </div>

        <div className="p-6 border-b space-y-4">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Timeline</h3>
          <OrderLifecycleBar status={order.status} variant="client" showActors={false} />
        </div>

        {showMockups && (
          <div className="space-y-3 border-b p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Shared mockups</h3>
            {(mockups || []).length === 0 ? (
              <p className="text-sm text-gray-500">No mockups shared yet.</p>
            ) : (
              <ul className="space-y-2">
                {(mockups || []).map((mockup) => {
                  const href = fileHref(mockup.storage_path)
                  return (
                    <li key={mockup.id} className="flex flex-col gap-2 rounded-xl border border-[#E8E4DE] bg-[#FAF7F2] p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{mockup.file_name || 'Mockup'}</p>
                        <p className="text-xs text-gray-500">{mockup.mime_type} · {formatDate(mockup.created_at)}</p>
                      </div>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#806A50]"
                        >
                          Open
                        </a>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}

        {order.status === 'client_approval' && (
          <div className="space-y-3 border-b p-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Client approval</h3>
            {order.client_approval_status === 'approved' ? (
              <p className="text-sm text-emerald-800">
                You approved this order{order.client_approval_note ? `: ${order.client_approval_note}` : '.'} Production can start once the team advances it.
              </p>
            ) : (
              <p className="text-sm text-gray-600">Review the shared mockup, then approve it or ask for changes.</p>
            )}
            <ActionForm action={decideOrderApproval} className="space-y-3">
              <input type="hidden" name="order_id" value={order.id} />
              <label className="block space-y-1 text-xs text-gray-500">
                Note (optional)
                <textarea name="note" rows={3} maxLength={2000} className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900" placeholder="Anything the team should know" />
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SubmitButton name="decision" value="approved" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#806A50] px-4 text-xs font-semibold text-white" pendingLabel="Approving…">
                  Approve
                </SubmitButton>
                <SubmitButton name="decision" value="changes_requested" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-4 text-xs font-semibold text-[#806A50]" pendingLabel="Saving…">
                  Request changes
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}

        {order.status === 'mockup' && order.client_approval_status === 'changes_requested' && (
          <div className="border-b px-6 py-4">
            <p className="text-sm text-amber-900">
              You asked for changes{order.client_approval_note ? `: ${order.client_approval_note}` : '.'} The team will share an updated mockup.
            </p>
          </div>
        )}

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
                              className="font-medium text-gray-900 hover:text-[#806A50] hover:underline"
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
