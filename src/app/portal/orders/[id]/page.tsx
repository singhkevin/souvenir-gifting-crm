import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { paymentLabel } from '@/lib/orders/payment'
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

function OrderStatusChip({ status }: { status: string }) {
  const label = CLIENT_STATUS_LABELS[status] || status
  if (['delivered', 'fulfilled'].includes(status)) {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  if (['cancelled', 'rejected'].includes(status)) {
    return (
      <span className="inline-block border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  if (['client_approval', 'production', 'mockup', 'dispatch'].includes(status)) {
    return (
      <span className="inline-block border border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        {label}
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#1C1C18] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
      {label}
    </span>
  )
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
      id, order_number, status, order_value, expected_delivery_date, dispatch_date, created_at, tracking_number, company_id, campaign_id, quotation_id, requirement_id,
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
  const [{ data: mockups }, { data: invoices }] = await Promise.all([
    mockupQuery,
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, status, due_date, invoice_date, created_at')
      .eq('order_id', id)
      .order('invoice_date', { ascending: false }),
  ])
  const invoice = (invoices || [])[0] ?? null
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
    <div className="max-w-5xl mx-auto space-y-6 min-w-0">
      <div className="flex items-center justify-between border-b border-[#CCC5BD] pb-4">
        <BackButton
          href="/portal/orders"
          label="Back to orders"
          className="text-xs uppercase tracking-wider text-[#4A4640] hover:text-[#9E4300]"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-[#7C766F]">{order.order_number}</span>
          <OrderStatusChip status={order.status} />
        </div>
      </div>

      {approvalError && (
        <p className="border border-[#BA1A1A] bg-[#FFDAD6] px-4 py-3 text-xs text-[#BA1A1A] rounded-none font-medium">
          {approvalError}
        </p>
      )}

      {/* Main Order Container */}
      <div className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
        {/* Header Summary */}
        <div className="p-6 bg-[#FCF9F2] space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                Order // {order.order_number}
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C18] tracking-tight">
                {campaign?.name || order.order_number}
              </h1>
              {campaign?.employee_quantity && (
                <p className="text-xs text-[#4A4640]">
                  Recipients: <span className="font-mono font-medium text-[#1C1C18]">{campaign.employee_quantity.toLocaleString('en-IN')} units</span>
                </p>
              )}
              {quotation?.quotation_number && (
                <p className="text-xs text-[#7C766F]">
                  Quote:{' '}
                  <span className="font-mono font-medium text-[#1C1C18]">{quotation.quotation_number}</span>
                  {quotation.total != null ? ` · ${formatCurrency(quotation.total)}` : ''}
                </p>
              )}
            </div>
            <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#CCC5BD]">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                Total Order Value
              </span>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1C1C18]">
                {formatCurrency(order.order_value)}
              </p>
              <p className="font-mono text-xs text-[#7C766F] mt-1">
                Expected: {formatDate(order.expected_delivery_date)}
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#CCC5BD] text-xs">
            <div className="border border-[#CCC5BD] bg-white p-3 rounded-none">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Status</span>
              <span className="font-mono font-semibold text-[#1C1C18] block mt-0.5">
                {CLIENT_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
            <div className="border border-[#CCC5BD] bg-white p-3 rounded-none">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Invoice</span>
              <span className="font-mono font-semibold text-[#1C1C18] block mt-0.5">
                {paymentLabel(invoice?.status)}
              </span>
            </div>
            <div className="border border-[#CCC5BD] bg-white p-3 rounded-none">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Created</span>
              <span className="font-mono text-[#1C1C18] block mt-0.5">
                {formatDate(order.created_at)}
              </span>
            </div>
            <div className="border border-[#CCC5BD] bg-white p-3 rounded-none">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Dispatch</span>
              <span className="font-mono text-[#1C1C18] block mt-0.5">
                {order.dispatch_date ? formatDate(order.dispatch_date) : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#CCC5BD] pb-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
              Timeline
            </span>
            <span className="font-mono text-xs text-[#7C766F]">
              Current: {CLIENT_STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
          <div className="border border-[#CCC5BD] p-4 bg-[#FCF9F2] rounded-none">
            <OrderLifecycleBar status={order.status} variant="client" showActors={false} />
          </div>
        </div>

        {/* Dispatch & Courier Information */}
        {order.tracking_number ? (
          <div className="p-6 bg-[#DAE6D3]/30 border-b border-[#CCC5BD]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none border border-[#3A4537] bg-[#DAE6D3] flex items-center justify-center shrink-0">
                <Truck size={16} className="text-[#3A4537]" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-[#1C1C18] uppercase tracking-wider text-[11px]">Dispatched</p>
                <p className="text-[#4A4640] mt-0.5">
                  Courier:{' '}
                  <span className="font-medium text-[#1C1C18]">{courier?.name || 'Carrier'}</span>
                  {' · '}
                  AWB:{' '}
                  <span className="font-mono font-bold text-[#1C1C18]">{order.tracking_number}</span>
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Client approval Box (If Active) */}
        {order.status === 'client_approval' && (
          <div className="p-6 space-y-4 bg-[#FFDBCB]/20 border-l-4 border-l-[#9E4300]">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                Action needed // Mockup approval
              </span>
              <h2 className="font-serif text-2xl text-[#1C1C18] mt-1">Client approval</h2>
              {order.client_approval_status === 'approved' ? (
                <p className="text-sm text-[#3A4537] mt-1 font-medium">
                  You approved this order{order.client_approval_note ? `: ${order.client_approval_note}` : '.'} Production can start once the team advances it.
                </p>
              ) : (
                <p className="text-sm text-[#4A4640] mt-1">
                  Review the shared mockup, then approve it or ask for changes.
                </p>
              )}
            </div>

            <ActionForm action={decideOrderApproval} className="space-y-4">
              <input type="hidden" name="order_id" value={order.id} />
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                  Note (optional)
                </label>
                <textarea
                  name="note"
                  rows={3}
                  maxLength={2000}
                  className="w-full bg-[#F1EEE7] border border-[#CCC5BD] p-3 text-sm text-[#1C1C18] rounded-none focus:border-[#1C1B1A] focus:outline-none placeholder:text-[#7C766F]"
                  placeholder="Anything the team should know"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <SubmitButton
                  name="decision"
                  value="approved"
                  className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] bg-[#1C1B1A] hover:bg-[#9E4300] text-white rounded-none transition-colors"
                  pendingLabel="Approving…"
                >
                  Approve
                </SubmitButton>
                <SubmitButton
                  name="decision"
                  value="changes_requested"
                  className="inline-flex min-h-11 items-center justify-center px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] text-[#1C1B1A] bg-transparent hover:bg-[#F6F3EC] rounded-none transition-colors"
                  pendingLabel="Saving…"
                >
                  Request changes
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        )}

        {/* Changes requested Banner */}
        {order.status === 'mockup' && order.client_approval_status === 'changes_requested' && (
          <div className="p-4 bg-[#FFDBCB]/30 border-l-4 border-l-[#9E4300] text-sm text-[#1C1C18]">
            <span className="font-bold uppercase tracking-wider text-[11px] text-[#9E4300] block mb-1">
              Changes requested
            </span>
            <p>
              You asked for changes{order.client_approval_note ? `: "${order.client_approval_note}"` : '.'} The team will share an updated mockup.
            </p>
          </div>
        )}

        {/* Documents Section: Invoices & Mockups */}
        <div className="p-6 space-y-6">
          <div className="border-b border-[#CCC5BD] pb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              Documents
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoices */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1C18]">Invoices</h3>
              {(invoices || []).length === 0 ? (
                <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-xs text-[#7C766F] rounded-none">
                  No invoices for this order yet.
                </div>
              ) : (
                <ul className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
                  {(invoices || []).map((inv) => (
                    <li key={inv.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F6F3EC] transition-colors">
                      <div>
                        <p className="font-mono font-semibold text-[#1C1C18]">{inv.invoice_number}</p>
                        <p className="font-mono text-[11px] text-[#7C766F]">
                          {formatDate(inv.invoice_date)} · due {formatDate(inv.due_date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(inv.amount)}</p>
                        <p className="text-[10px] uppercase text-[#7C766F]">{inv.status}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Shared mockups */}
            {showMockups ? (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1C1C18]">Shared mockups</h3>
                {(mockups || []).length === 0 ? (
                  <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-xs text-[#7C766F] rounded-none">
                    No mockups shared yet.
                  </div>
                ) : (
                  <ul className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
                    {(mockups || []).map((mockup) => {
                      const href = fileHref(mockup.storage_path)
                      return (
                        <li key={mockup.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#F6F3EC] transition-colors">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium text-[#1C1C18] truncate">{mockup.file_name || 'Mockup'}</p>
                            <p className="font-mono text-[11px] text-[#7C766F]">
                              {mockup.mime_type} · {formatDate(mockup.created_at)}
                            </p>
                          </div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:bg-[#1C1B1A] hover:text-white transition-colors rounded-none shrink-0"
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
            ) : null}
          </div>
        </div>

        {/* Consignment Items Table */}
        <div className="p-6 space-y-4">
          <div className="border-b border-[#CCC5BD] pb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              Items ({items.length})
            </span>
          </div>

          <div className="border border-[#CCC5BD] bg-white rounded-none overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[560px]">
              <thead>
                <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Units</th>
                  <th className="py-3 px-4 text-right">Unit</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-[#7C766F] bg-[#FCF9F2]">
                      No products on this order yet.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const name = item.product?.name || item.description || 'Product'
                    const canOpen = Boolean(item.product?.id && item.product.status === 'active')
                    return (
                      <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <ProductImage
                              src={item.product?.image_url}
                              alt={name}
                              size="xs"
                              className="rounded-none border border-[#CCC5BD] shrink-0"
                            />
                            <div className="min-w-0">
                              {canOpen ? (
                                <Link
                                  href={`/portal/gifts/${item.product!.id}`}
                                  className="font-medium text-[#1C1C18] hover:text-[#9E4300] transition-colors"
                                >
                                  {name}
                                </Link>
                              ) : (
                                <p className="font-medium text-[#1C1C18]">{name}</p>
                              )}
                              {item.product?.sku && (
                                <p className="font-mono text-[10px] text-[#7C766F] mt-0.5">
                                  SKU: {item.product.sku}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[#1C1C18]">
                          {item.quantity}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-[#4A4640]">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1C1C18]">
                          {formatCurrency(item.line_total ?? item.unit_price)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
