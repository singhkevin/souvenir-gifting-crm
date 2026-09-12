import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, formatDateTime, isUuid, oneRelation } from '@/lib/utils'
import {
  advanceOrderStatus,
  assignSupplier,
  assignCourier,
  assignPrintingVendor,
  recordDelivery,
  saveOrderCosting,
  handOffOrder,
} from '../actions'
import { getProfile, canSeeCosts, canChangeOrderStage, applyOrderScope } from '@/lib/auth'
import {
  ORDER_LIFECYCLE,
  ORDER_STATUS_LABELS,
  orderHealth,
  HEALTH_LABELS,
  HEALTH_STYLES,
} from '@/lib/order-workflow'
import { OrderLifecycleBar } from '@/components/orders/order-lifecycle'
import { ProductImage } from '@/components/ui/product-image'
import { ClientTabs } from '@/components/ui/client-tabs'
import { ShoppingBag, ChevronRight } from 'lucide-react'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { tab = 'details' } = await searchParams
  const profile = await getProfile()
  if (!profile) return redirect('/login')
  if (profile.role === 'client_admin') return redirect('/portal/catalogue')

  const supabase = await createClient()

  const [
    orderRes,
    { data: orderItems },
    { data: history },
    { data: assignments },
    { data: suppliers },
    { data: printingVendors },
    { data: courierPartners },
    { data: departments },
    { data: staff },
  ] = await Promise.all([
    applyOrderScope(
      supabase
        .from('orders')
        .select(`
          *,
          company:companies(id, name),
          supplier:suppliers(id, name),
          printing_vendor:printing_vendors(id, name),
          courier_partner:courier_partners(id, name),
          quotation:quotations(id, quotation_number),
          requirement:requirements(id, name),
          assignee:assigned_to(id, full_name),
          department:current_department_id(id, name),
          campaign:campaign_id(id, name)
        `)
        .eq('id', id),
      profile
    ).maybeSingle(),
    supabase.from('order_items').select('id, description, quantity, unit_price, line_total, product:products(id, name, sku, image_url, status)').eq('order_id', id),
    supabase.from('order_status_history').select('*, changer:changed_by(id, full_name)').eq('order_id', id).order('changed_at', { ascending: false }),
    supabase.from('order_assignments').select('*, assignee:assigned_to(full_name), department:department_id(name), assigner:assigned_by(full_name)').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('printing_vendors').select('id, name').order('name'),
    supabase.from('courier_partners').select('id, name').order('name'),
    supabase.from('departments').select('id, name, slug, manager_id').order('name'),
    supabase.from('profiles').select('id, full_name, department_id').in('role', ['admin', 'sales', 'operations', 'accounts', 'management']).eq('is_active', true).order('full_name'),
  ])

  const order = orderRes.data
  if (!order) notFound()

  const isDelivered = order.status === 'delivered' || order.status === 'cancelled'
  const health = orderHealth(order.status, order.expected_delivery_date, order.stage_due_at)
  const showCosts = canSeeCosts(profile.role)
  const canStage = canChangeOrderStage(profile.role)
  const assignee = oneRelation(order.assignee)
  const department = oneRelation(order.department)
  const campaign = oneRelation(order.campaign)
  const company = oneRelation(order.company)
  const supplier = oneRelation(order.supplier)
  const printingVendor = oneRelation(order.printing_vendor)
  const courierPartner = oneRelation(order.courier_partner)
  const quotation = oneRelation(order.quotation)
  const tabs = showCosts
    ? ['details', 'products', 'vendors', 'financials', 'history']
    : ['details', 'products', 'vendors', 'history']

  const handleAdvance = async () => {
    'use server'
    await advanceOrderStatus(id, 'Advanced from order detail')
  }

  const handleAssignSupplier = async (formData: FormData) => {
    'use server'
    const sId = formData.get('supplier_id') as string
    await assignSupplier(id, sId)
  }

  const handleAssignCourier = async (formData: FormData) => {
    'use server'
    const cId = formData.get('courier_partner_id') as string
    const tracking = formData.get('tracking_number') as string
    await assignCourier(id, cId, tracking)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <BackButton href="/crm/order-management" label="Back to Order Control" />

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="p-1.5 bg-[#1A3022]/10 text-[#1A3022] rounded-lg">
              <ShoppingBag size={16} />
            </span>
            <span className="font-mono text-xs font-bold text-gray-500">{order.order_number}</span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-[#1A3022] uppercase">
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${HEALTH_STYLES[health]}`}>
              {HEALTH_LABELS[health]}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {company?.name || 'Client'}
            {campaign?.name ? ` · ${campaign.name}` : ''}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Department: <span className="font-medium text-gray-700">{department?.name || '—'}</span>
            {' · '}Assigned: <span className="font-medium text-gray-700">{assignee?.full_name || 'Unassigned'}</span>
            {' · '}Stage due: <span className="font-medium text-gray-700">{formatDate(order.stage_due_at)}</span>
            {' · '}Delivery: <span className="font-medium text-gray-700">{formatDate(order.expected_delivery_date)}</span>
          </p>
          {order.next_action && <p className="text-xs mt-2 text-[#1A3022]">Next: {order.next_action}</p>}
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Order Value</p>
            <p className="text-xl font-bold text-[#1A3022]">{formatCurrency(order.order_value)}</p>
          </div>
          {canStage && !isDelivered && (
            <form action={handleAdvance}>
              <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5">
                Advance Stage <ChevronRight size={14} />
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div>
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Lifecycle</h3>
          <p className="text-[11px] text-[#7A7267] mt-1">
            Current stage: {ORDER_STATUS_LABELS[order.status] || order.status}
            {assignee?.full_name ? ` · Assigned to ${assignee.full_name}` : ''}
            {department?.name ? ` · ${department.name}` : ''}
          </p>
        </div>
        <OrderLifecycleBar status={order.status} history={history} showActors />
      </div>

      {canStage && !isDelivered && (
        <form action={asFormAction(handOffOrder)} className="bg-white p-6 rounded-2xl border border-gray-200 grid md:grid-cols-2 gap-3 text-xs">
          <input type="hidden" name="order_id" value={order.id} />
          <h3 className="md:col-span-2 font-bold text-sm">Stage hand-off</h3>
          <MobileSheetSelect
            name="status"
            label="New stage"
            showDesktopLabel
            defaultValue={order.status}
            options={[
              ...ORDER_LIFECYCLE.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
          <MobileSheetSelect
            name="department_id"
            label="Department"
            showDesktopLabel
            defaultValue={order.current_department_id || ''}
            emptyLabel="Keep current"
            options={[
              { value: '', label: 'Keep current' },
              ...(departments || []).map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <MobileSheetSelect
            name="assigned_to"
            label="Assignee"
            showDesktopLabel
            defaultValue={order.assigned_to || ''}
            emptyLabel="Keep current"
            options={[
              { value: '', label: 'Keep current' },
              ...(staff || []).map((s) => ({ value: s.id, label: s.full_name })),
            ]}
          />
          <SheetDateField
            name="stage_due"
            label="Stage due date"
            showDesktopLabel
            defaultValue={order.stage_due_at || ''}
          />
          <label className="md:col-span-2 space-y-1">
            <span className="text-gray-500">Next action</span>
            <input name="next_action" defaultValue={order.next_action || ''} className="w-full border rounded-lg px-2 py-2" />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="text-gray-500">Comment / reason</span>
            <textarea name="comment" rows={2} className="w-full border rounded-lg px-2 py-2" placeholder="Why is this moving?" />
          </label>
          <button className="md:col-span-2 bg-[#1A3022] text-white rounded-lg py-2 font-semibold">Record hand-off</button>
        </form>
      )}

      <ClientTabs
        tabs={tabs}
        initialTab={tabs.includes(tab) ? tab : 'details'}
        panels={{
          details: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border text-xs space-y-3">
                <h3 className="font-bold text-sm pb-2 border-b">Fulfillment</h3>
                <div>PO: {order.po_number || '—'}</div>
                <div>Dispatch: {formatDate(order.dispatch_date)}</div>
                <div>Supplier: {supplier?.name || '—'}</div>
                <div>Printing vendor: {printingVendor?.name || '—'}</div>
                <div>Courier: {courierPartner?.name || '—'}</div>
                <div>Tracking: {order.tracking_number || '—'}</div>
                <div>Expected delivery: {formatDate(order.expected_delivery_date)}</div>
                <div>Actual delivery: {formatDate(order.actual_delivery_date)}</div>
                <div>Quote: {quotation?.quotation_number || '—'}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border text-xs space-y-3">
                <h3 className="font-bold text-sm pb-2 border-b">Operational notes</h3>
                <p className="whitespace-pre-wrap">{order.notes || 'No special operational instructions.'}</p>
              </div>
            </div>
          ),
          products: (
            <div className="bg-white rounded-2xl border overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50"><tr>
                  <th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Unit</th><th className="p-3 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {(orderItems || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        No products on this order yet.
                        {order.quotation_id ? ' Converted quotations should copy line items automatically — check the linked quotation.' : ''}
                      </td>
                    </tr>
                  ) : (
                    orderItems?.map((item: {
                      id: string
                      description?: string | null
                      quantity: number
                      unit_price: number
                      line_total: number
                      product?:
                        | { id?: string; name?: string; sku?: string; image_url?: string | null; status?: string }
                        | { id?: string; name?: string; sku?: string; image_url?: string | null; status?: string }[]
                        | null
                    }) => {
                      const product = oneRelation(item.product)
                      const name = product?.name || item.description || 'Product'
                      const canOpen = Boolean(product?.id && product.status === 'active')
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <ProductImage
                                src={product?.image_url}
                                alt={name}
                                size="xs"
                                className="h-10 w-10 rounded-lg border border-gray-100"
                              />
                              <div>
                                {canOpen ? (
                                  <Link
                                    href={`/crm/products/${product!.id}`}
                                    className="font-semibold text-gray-900 hover:text-[#1A3022] hover:underline"
                                  >
                                    {name}
                                  </Link>
                                ) : (
                                  <span className="font-semibold text-gray-900">{name}</span>
                                )}
                                {product?.sku ? <div className="font-mono text-[10px] text-gray-400">{product.sku}</div> : null}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">{item.quantity}</td>
                          <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="p-3 text-right">{formatCurrency(item.line_total)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          ),
          vendors: (
            <div className="grid md:grid-cols-2 gap-6">
              <form action={handleAssignSupplier} className="bg-white p-6 rounded-2xl border space-y-3 text-xs">
                <h3 className="font-bold">Supplier</h3>
                <MobileSheetSelect
                  name="supplier_id"
                  label="Supplier"
                  defaultValue={order.supplier_id || ''}
                  disabled={!canStage}
                  emptyLabel="Select"
                  options={[
                    { value: '', label: 'Select' },
                    ...(suppliers || []).map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                {canStage && <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg">Save supplier</button>}
              </form>

              <form action={asFormAction(assignPrintingVendor)} className="bg-white p-6 rounded-2xl border space-y-3 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <h3 className="font-bold">Printing vendor</h3>
                <MobileSheetSelect
                  name="printing_vendor_id"
                  label="Printing vendor"
                  defaultValue={order.printing_vendor_id || ''}
                  disabled={!canStage}
                  emptyLabel="Select"
                  options={[
                    { value: '', label: 'Select' },
                    ...(printingVendors || []).map((v) => ({ value: v.id, label: v.name })),
                  ]}
                />
                {canStage && <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg">Save printing vendor</button>}
              </form>

              <form action={handleAssignCourier} className="bg-white p-6 rounded-2xl border space-y-3 text-xs">
                <h3 className="font-bold">Courier</h3>
                <MobileSheetSelect
                  name="courier_partner_id"
                  label="Courier"
                  defaultValue={order.courier_partner_id || ''}
                  disabled={!canStage}
                  emptyLabel="Select"
                  options={[
                    { value: '', label: 'Select' },
                    ...(courierPartners || []).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <input name="tracking_number" defaultValue={order.tracking_number || ''} placeholder="AWB / tracking number" disabled={!canStage} className="w-full border rounded-lg px-2 py-2 disabled:bg-gray-50" />
                {canStage && <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg">Save shipping</button>}
              </form>

              <form action={asFormAction(recordDelivery)} className="bg-white p-6 rounded-2xl border space-y-3 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <h3 className="font-bold">Dispatch &amp; delivery</h3>
                <SheetDateField
                  name="dispatch_date"
                  label="Dispatch date"
                  showDesktopLabel
                  defaultValue={order.dispatch_date || ''}
                  disabled={!canStage}
                />
                <SheetDateField
                  name="expected_delivery_date"
                  label="Expected delivery"
                  showDesktopLabel
                  defaultValue={order.expected_delivery_date || ''}
                  disabled={!canStage}
                />
                <SheetDateField
                  name="actual_delivery_date"
                  label="Actual delivery"
                  showDesktopLabel
                  defaultValue={order.actual_delivery_date || ''}
                  disabled={!canStage}
                />
                {canStage && <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg">Save delivery dates</button>}
              </form>
            </div>
          ),
          ...(showCosts
            ? {
                financials: (
                  <div className="grid md:grid-cols-2 gap-6">
                    <form action={asFormAction(saveOrderCosting)} className="bg-white p-6 rounded-2xl border space-y-3 text-xs">
                      <input type="hidden" name="order_id" value={order.id} />
                      <h3 className="font-bold text-sm">Order costing</h3>
                      {(
                        [
                          ['product_cost', 'Product cost'],
                          ['printing_cost', 'Printing cost'],
                          ['courier_cost', 'Courier cost'],
                          ['other_cost', 'Other cost'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="block space-y-1">
                          <span className="text-gray-500">{label}</span>
                          <input
                            type="number"
                            name={field}
                            min={0}
                            step="0.01"
                            defaultValue={order[field] ?? 0}
                            className="w-full border rounded-lg px-2 py-2"
                          />
                        </label>
                      ))}
                      <button type="submit" className="px-4 py-2 bg-[#1A3022] text-white rounded-lg font-semibold">Save costing</button>
                    </form>

                    <div className="bg-white p-6 rounded-2xl border text-xs space-y-3">
                      <h3 className="font-bold text-sm">Internal profitability</h3>
                      <div className="flex justify-between"><span>Revenue</span><span>{formatCurrency(order.order_value)}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Product cost</span><span>{formatCurrency(order.product_cost)}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Printing cost</span><span>{formatCurrency(order.printing_cost)}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Courier cost</span><span>{formatCurrency(order.courier_cost)}</span></div>
                      <div className="flex justify-between text-gray-500"><span>Other cost</span><span>{formatCurrency(order.other_cost)}</span></div>
                      <div className="flex justify-between pt-2 border-t"><span>Total cost</span><span>{formatCurrency(order.total_cost)}</span></div>
                      <div className="flex justify-between font-semibold text-[#1A3022]"><span>Gross profit</span><span>{formatCurrency(order.gross_profit)}</span></div>
                      <div className="flex justify-between font-semibold">
                        <span>Margin</span>
                        <span>{Number(order.order_value) > 0 ? `${((Number(order.gross_profit || 0) / Number(order.order_value)) * 100).toFixed(1)}%` : '—'}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 pt-2 border-t">
                        Total cost and gross profit are recalculated on the server and cannot be overwritten directly.
                      </p>
                    </div>
                  </div>
                ),
              }
            : {}),
          history: (
            <div className="bg-white p-6 rounded-2xl border space-y-4">
              {(history || []).map((entry: { id: string; from_status?: string; to_status?: string; note?: string; changed_at?: string; created_at?: string; changer?: { full_name?: string } }) => {
                const changer = Array.isArray(entry.changer) ? entry.changer[0] : entry.changer
                return (
                  <div key={entry.id} className="flex gap-3 text-xs">
                    <div className="w-2.5 h-2.5 mt-1 rounded-full bg-[#1A3022]" />
                    <div>
                      <p className="font-bold">{ORDER_STATUS_LABELS[entry.from_status || ''] || entry.from_status || '—'} → {ORDER_STATUS_LABELS[entry.to_status || ''] || entry.to_status}</p>
                      <p className="text-gray-400">{formatDateTime(entry.changed_at || entry.created_at)} · {changer?.full_name || 'Team'}</p>
                      {entry.note && <p className="mt-1 bg-gray-50 p-2 rounded">{entry.note}</p>}
                    </div>
                  </div>
                )
              })}
              {(assignments || []).map((a: { id: string; note?: string; created_at: string; assignee?: { full_name?: string }; department?: { name?: string }; assigner?: { full_name?: string } }) => (
                <div key={a.id} className="text-xs text-gray-600 pl-5">
                  Assigned to {(Array.isArray(a.assignee) ? a.assignee[0] : a.assignee)?.full_name || '—'}
                  {(Array.isArray(a.department) ? a.department[0] : a.department)?.name ? ` · ${(Array.isArray(a.department) ? a.department[0] : a.department)?.name}` : ''}
                  {' · '}{formatDateTime(a.created_at)}
                  {a.note ? ` · ${a.note}` : ''}
                </div>
              ))}
              {(!history || history.length === 0) && <p className="text-xs text-gray-400">No stage history yet.</p>}
            </div>
          ),
        }}
      />
    </div>
  )
}
