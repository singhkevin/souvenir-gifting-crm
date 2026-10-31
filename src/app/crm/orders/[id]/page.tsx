import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, formatDateTime, isUuid, oneRelation } from '@/lib/utils'
import {
  advanceOrderStatus,
  assignSupplierForm,
  assignCourierForm,
  assignPrintingVendor,
  recordDelivery,
  saveOrderCosting,
  handOffOrder,
} from '../actions'
import { requireStaff, canSeeCosts, canChangeOrderStage, applyOrderScope } from '@/lib/auth'
import { isOrderSource, ORDER_SOURCE_LABELS } from '@/lib/orders/source'
import {
  ORDER_STATUS_LABELS,
  canAdvanceTo,
  handoffStageOptions,
  nextLifecycleStatus,
  orderHealth,
  HEALTH_LABELS,
} from '@/lib/order-workflow'
import { OrderLifecycleBar } from '@/components/orders/order-lifecycle'
import { ProductImage } from '@/components/ui/product-image'
import { ClientTabs } from '@/components/ui/client-tabs'
import { FulfilmentPanel } from '@/components/orders/fulfilment-panel'
import { lineLifecycleEnabled } from '@/lib/orders/line-lifecycle-server'
import { ChevronRight } from 'lucide-react'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { ActionButton } from '@/components/ui/action-button'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function OrderDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; stage_error?: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { tab, stage_error: stageError } = await searchParams
  const profile = await requireStaff() // staff only; runners use /crm/runs

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

  // After the line-lifecycle migration, stages move per product line on the Fulfilment tab;
  // the order stage is derived from the lines, so Advance and stage hand-offs are retired.
  const lifecycleOn = await lineLifecycleEnabled(supabase)

  const isDelivered = order.status === 'delivered' || order.status === 'cancelled'
  const approvalStatus = order.client_approval_status ?? null
  const nextStage = nextLifecycleStatus(order.status)
  const advanceGate = nextStage ? canAdvanceTo(order.status, nextStage, approvalStatus) : null
  const health = orderHealth(order.status, order.expected_delivery_date, order.stage_due_at)
  const showCosts = canSeeCosts(profile.role)
  const canStage = canChangeOrderStage(profile.role)
  const sourceValue = typeof order.source === 'string' ? order.source : ''
  const assignee = oneRelation(order.assignee)
  const department = oneRelation(order.department)
  const campaign = oneRelation(order.campaign)
  const company = oneRelation(order.company)
  const supplier = oneRelation(order.supplier)
  const printingVendor = oneRelation(order.printing_vendor)
  const courierPartner = oneRelation(order.courier_partner)
  const quotation = oneRelation(order.quotation)
  const baseTabs = showCosts
    ? ['details', 'products', 'vendors', 'financials', 'history']
    : ['details', 'products', 'vendors', 'history']
  const tabs = lifecycleOn ? ['fulfilment', ...baseTabs] : baseTabs
  const handoffOptions = lifecycleOn
    ? handoffStageOptions(order.status, approvalStatus).filter((o) => o.value === order.status || o.value === 'cancelled')
    : handoffStageOptions(order.status, approvalStatus)

  const healthChip = (() => {
    switch (health) {
      case 'on_track':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
            {HEALTH_LABELS[health]}
          </span>
        )
      case 'at_risk':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
            {HEALTH_LABELS[health]}
          </span>
        )
      case 'delayed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
            {HEALTH_LABELS[health]}
          </span>
        )
    }
  })()

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <BackButton href="/crm/order-management" label="Back to Order Control" />

      {stageError && (
        <p className="text-xs text-[#BA1A1A] bg-[#FBEDEB] border border-[#BA1A1A]/40 rounded-none px-3 py-2">
          {stageError}
        </p>
      )}

      {/* Header Panel */}
      <div className="bg-[#FCF9F2] p-6 border border-[#CCC5BD] rounded-none shadow-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
            <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
            <span>/</span>
            <Link href="/crm/order-management" className="hover:text-[#9E4300] transition-colors">ORDERS</Link>
            <span>/</span>
            <span className="text-[#9E4300] font-semibold">{order.order_number}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#F6F3EC] text-[#1C1C18] border border-[#CCC5BD] rounded-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
              {ORDER_STATUS_LABELS[order.status] || order.status}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] uppercase border border-[#CCC5BD] text-[#4A4640] bg-[#F6F3EC] rounded-none">
              {isOrderSource(sourceValue) ? ORDER_SOURCE_LABELS[sourceValue] : 'CRM'}
            </span>
            {order.without_quotation ? (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] uppercase border border-[#9E4300]/40 bg-[#FFB690]/30 text-[#9E4300] rounded-none">
                Created without a quotation
              </span>
            ) : null}
            {healthChip}
          </div>

          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1C18]">
            {company?.name || 'Client'}
            {campaign?.name ? ` · ${campaign.name}` : ''}
          </h1>

          <p className="text-xs text-[#4A4640] mt-1.5">
            Department: <span className="font-medium text-[#1C1C18]">{department?.name || '—'}</span>
            {' · '}Assigned: <span className="font-medium text-[#1C1C18]">{assignee?.full_name || 'Unassigned'}</span>
            {' · '}Stage due: <span className="font-mono text-[#1C1C18]">{formatDate(order.stage_due_at)}</span>
            {' · '}Delivery: <span className="font-mono text-[#1C1C18]">{formatDate(order.expected_delivery_date)}</span>
          </p>
          {order.next_action && <p className="text-xs mt-1 text-[#9E4300] font-medium">Next: {order.next_action}</p>}
        </div>

        <div className="flex items-center gap-5 shrink-0 self-start xl:self-center">
          <div className="text-right">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order Value</span>
            <span className="font-mono text-xl font-bold text-[#1C1C18] mt-0.5 block">{formatCurrency(order.order_value)}</span>
          </div>
          {canStage && !lifecycleOn && !isDelivered && nextStage && advanceGate?.ok && (
            <ActionButton
              action={advanceOrderStatus.bind(null, id, order.status)}
              pendingLabel="Advancing…"
              className="px-4 py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none inline-flex items-center gap-1.5"
            >
              Advance to {ORDER_STATUS_LABELS[nextStage]} <ChevronRight size={14} />
            </ActionButton>
          )}
          {canStage && !lifecycleOn && !isDelivered && nextStage === 'production' && advanceGate && !advanceGate.ok && (
            <p className="max-w-xs rounded-none border border-[#9E4300]/30 bg-[#FFB690]/20 px-3 py-2 text-xs text-[#9E4300]">
              Waiting for the client to approve before Production.
            </p>
          )}
        </div>
      </div>

      {/* Lifecycle Panel */}
      <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden p-6 space-y-4">
        <div className="border-b border-[#CCC5BD] pb-3">
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Lifecycle</h2>
          <p className="text-xs text-[#4A4640] mt-0.5">
            Current stage: <strong className="text-[#1C1C18] font-semibold">{ORDER_STATUS_LABELS[order.status] || order.status}</strong>
            {assignee?.full_name ? ` · Assigned to ${assignee.full_name}` : ''}
            {department?.name ? ` · ${department.name}` : ''}
          </p>
        </div>
        <OrderLifecycleBar status={order.status} history={history} showActors />
        {!lifecycleOn && order.status === 'client_approval' && approvalStatus !== 'approved' && (
          <p className="text-xs text-[#9E4300] bg-[#FFB690]/20 border border-[#9E4300]/30 p-2.5 rounded-none">
            Waiting for the client to approve the mockup. Staff cannot start Production until then.
          </p>
        )}
        {approvalStatus === 'approved' && (
          <p className="text-xs text-[#3A4537] bg-[#DAE6D3] border border-[#3A4537]/20 p-2.5 rounded-none">
            Client approved{order.client_approval_note ? `: ${order.client_approval_note}` : '.'}
          </p>
        )}
        {approvalStatus === 'changes_requested' && (
          <p className="text-xs text-[#9E4300] bg-[#FFB690]/20 border border-[#9E4300]/30 p-2.5 rounded-none">
            Changes requested{order.client_approval_note ? `: ${order.client_approval_note}` : '.'}
          </p>
        )}
      </div>

      {/* Stage Hand-off Form */}
      {canStage && !isDelivered && (
        <ActionForm action={handOffOrder} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-6 grid md:grid-cols-2 gap-4 text-xs">
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="expected_status" value={order.status} />
          <div className="md:col-span-2 border-b border-[#CCC5BD] pb-2">
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Stage Hand-off</h2>
            {lifecycleOn ? (
              <p className="mt-1 text-xs text-[#4A4640]">Hand the order to another person or department. Stages now move per product line on the Fulfilment tab.</p>
            ) : null}
          </div>
          <MobileSheetSelect
            name="status"
            label="New stage"
            showDesktopLabel
            defaultValue={order.status}
            options={handoffOptions}
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
          <label className="md:col-span-2 block space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Next action</span>
            <input name="next_action" defaultValue={order.next_action || ''} className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0" />
          </label>
          <label className="md:col-span-2 block space-y-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Comment / reason</span>
            <textarea name="comment" rows={2} className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0" placeholder="Why is this moving?" />
          </label>
          <SubmitButton className="md:col-span-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] py-2.5 shadow-none" pendingLabel="Recording…">
            Record hand-off
          </SubmitButton>
        </ActionForm>
      )}

      {/* Tabs */}
      <ClientTabs
        tabs={tabs}
        initialTab={tab && tabs.includes(tab) ? tab : tabs[0]}
        activeClassName="border-[#9E4300] text-[#9E4300] font-bold tracking-[0.12em] uppercase"
        idleClassName="border-transparent text-[#7C766F] hover:text-[#1C1C18] font-bold tracking-[0.12em] uppercase"
        panels={{
          ...(lifecycleOn
            ? {
                fulfilment: (
                  <FulfilmentPanel
                    orderId={order.id}
                    role={profile.role}
                    showCosts={showCosts}
                    approvalStatus={approvalStatus}
                    approvalNote={order.client_approval_note ?? null}
                  />
                ),
              }
            : {}),
          details: (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
                <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD]">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Fulfillment</h3>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">PO Number</span>
                    <span className="mt-0.5 block font-mono text-[#1C1C18]">{order.po_number || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Dispatch</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{formatDate(order.dispatch_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Supplier</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{supplier?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Printing Vendor</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{printingVendor?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Courier</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{courierPartner?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Tracking Number</span>
                    <span className="mt-0.5 block font-mono text-[#1C1C18]">{order.tracking_number || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Expected Delivery</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{formatDate(order.expected_delivery_date)}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Actual Delivery</span>
                    <span className="mt-0.5 block text-[#1C1C18]">{formatDate(order.actual_delivery_date)}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quote</span>
                    <span className="mt-0.5 block font-mono text-[#1C1C18]">
                      {order.without_quotation ? 'Created without a quotation' : (quotation?.quotation_number || '—')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
                <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD]">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Operational Notes</h3>
                </div>
                <div className="p-4 text-xs">
                  <p className="whitespace-pre-wrap text-[#4A4640] leading-relaxed">{order.notes || 'No special operational instructions.'}</p>
                </div>
              </div>
            </div>
          ),
          products: (
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
              <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Order Products</h3>
                <span className="font-mono text-xs text-[#7C766F]">{(orderItems || []).length} items</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                    <tr>
                      <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Item</th>
                      <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Qty</th>
                      <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Unit</th>
                      <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#CCC5BD]">
                    {(orderItems || []).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-xs text-[#7C766F]">
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
                          <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <ProductImage
                                  src={product?.image_url}
                                  alt={name}
                                  size="xs"
                                  className="h-10 w-10 rounded-none border border-[#CCC5BD]"
                                />
                                <div>
                                  {canOpen ? (
                                    <Link
                                      href={`/crm/products/${product!.id}`}
                                      className="font-semibold text-sm text-[#1C1C18] hover:text-[#9E4300] hover:underline transition-colors"
                                    >
                                      {name}
                                    </Link>
                                  ) : (
                                    <span className="font-semibold text-sm text-[#1C1C18]">{name}</span>
                                  )}
                                  {product?.sku ? <div className="font-mono text-[11px] text-[#7C766F]">{product.sku}</div> : null}
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-[#1C1C18]">{item.quantity}</td>
                            <td className="py-3 px-4 text-right font-mono text-xs text-[#1C1C18]">{formatCurrency(item.unit_price)}</td>
                            <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#1C1C18]">{formatCurrency(item.line_total)}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ),
          vendors: (
            <div className="grid md:grid-cols-2 gap-6">
              <ActionForm action={assignSupplierForm} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 space-y-3.5 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="border-b border-[#CCC5BD] pb-2">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18]">Supplier</h3>
                </div>
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
                {canStage && (
                  <SubmitButton
                    className="px-4 py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none"
                    pendingLabel="Saving…"
                  >
                    Save supplier
                  </SubmitButton>
                )}
              </ActionForm>

              <ActionForm action={assignPrintingVendor} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 space-y-3.5 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="border-b border-[#CCC5BD] pb-2">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18]">Printing Vendor</h3>
                </div>
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
                {canStage && (
                  <SubmitButton
                    className="px-4 py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none"
                    pendingLabel="Saving…"
                  >
                    Save printing vendor
                  </SubmitButton>
                )}
              </ActionForm>

              <ActionForm action={assignCourierForm} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 space-y-3.5 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="border-b border-[#CCC5BD] pb-2">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18]">Courier</h3>
                </div>
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
                <label className="block space-y-1">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Tracking Number</span>
                  <input
                    name="tracking_number"
                    defaultValue={order.tracking_number || ''}
                    placeholder="AWB / tracking number"
                    disabled={!canStage}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0 disabled:opacity-60"
                  />
                </label>
                {canStage && (
                  <SubmitButton
                    className="px-4 py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none"
                    pendingLabel="Saving…"
                  >
                    Save shipping
                  </SubmitButton>
                )}
              </ActionForm>

              <ActionForm action={recordDelivery} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 space-y-3.5 text-xs">
                <input type="hidden" name="order_id" value={order.id} />
                <div className="border-b border-[#CCC5BD] pb-2">
                  <h3 className="font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18]">Dispatch &amp; Delivery</h3>
                </div>
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
                {canStage && (
                  <SubmitButton
                    className="px-4 py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none"
                    pendingLabel="Saving…"
                  >
                    Save delivery dates
                  </SubmitButton>
                )}
              </ActionForm>
            </div>
          ),
          ...(showCosts
            ? {
                financials: (
                  <div className="grid md:grid-cols-2 gap-6">
                    <ActionForm action={saveOrderCosting} className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 space-y-3.5 text-xs">
                      <input type="hidden" name="order_id" value={order.id} />
                      <div className="border-b border-[#CCC5BD] pb-2">
                        <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Order Costing</h3>
                      </div>
                      {(
                        [
                          ['product_cost', 'Product cost'],
                          ['printing_cost', 'Printing cost'],
                          ['courier_cost', 'Courier cost'],
                          ['other_cost', 'Other cost'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="block space-y-1">
                          <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">{label}</span>
                          <input
                            type="number"
                            name={field}
                            min={0}
                            step="0.01"
                            defaultValue={order[field] ?? 0}
                            className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                          />
                        </label>
                      ))}
                      <SubmitButton
                        className="w-full py-2 bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-xs font-bold uppercase tracking-[0.12em] shadow-none"
                        pendingLabel="Saving…"
                      >
                        Save costing
                      </SubmitButton>
                    </ActionForm>

                    <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-5 text-xs space-y-3">
                      <div className="border-b border-[#CCC5BD] pb-2">
                        <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Internal Profitability</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Revenue</span>
                          <span className="font-mono text-sm font-semibold text-[#1C1C18]">{formatCurrency(order.order_value)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#4A4640]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Product cost</span>
                          <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(order.product_cost)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#4A4640]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Printing cost</span>
                          <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(order.printing_cost)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#4A4640]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Courier cost</span>
                          <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(order.courier_cost)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[#4A4640]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Other cost</span>
                          <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(order.other_cost)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[#CCC5BD]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total cost</span>
                          <span className="font-mono text-xs font-semibold text-[#1C1C18]">{formatCurrency(order.total_cost)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-[#CCC5BD]">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">Gross profit</span>
                          <span className="font-mono text-sm font-bold text-[#9E4300]">{formatCurrency(order.gross_profit)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Margin</span>
                          <span className="font-mono text-xs font-bold text-[#1C1C18]">
                            {Number(order.order_value) > 0 ? `${((Number(order.gross_profit || 0) / Number(order.order_value)) * 100).toFixed(1)}%` : '—'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[#7C766F] pt-2 border-t border-[#CCC5BD]">
                        Total cost and gross profit are recalculated on the server and cannot be overwritten directly.
                      </p>
                    </div>
                  </div>
                ),
              }
            : {}),
          history: (
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none p-6 space-y-4">
              <div className="border-b border-[#CCC5BD] pb-2">
                <h3 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Stage History &amp; Assignments</h3>
              </div>
              <div className="space-y-4">
                {(history || []).map((entry: { id: string; from_status?: string; to_status?: string; note?: string; changed_at?: string; created_at?: string; changer?: { full_name?: string } }) => {
                  const changer = Array.isArray(entry.changer) ? entry.changer[0] : entry.changer
                  return (
                    <div key={entry.id} className="flex gap-3 text-xs">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-[#9E4300] shrink-0" />
                      <div>
                        <p className="font-semibold text-sm text-[#1C1C18]">
                          {ORDER_STATUS_LABELS[entry.from_status || ''] || entry.from_status || '—'} → {ORDER_STATUS_LABELS[entry.to_status || ''] || entry.to_status}
                        </p>
                        <p className="font-mono text-[11px] text-[#7C766F] mt-0.5">
                          {formatDateTime(entry.changed_at || entry.created_at)} · <span className="font-sans text-[#4A4640]">{changer?.full_name || 'Team'}</span>
                        </p>
                        {entry.note && (
                          <p className="mt-1.5 bg-[#F6F3EC] p-2.5 rounded-none border border-[#CCC5BD] text-[#4A4640] leading-relaxed">
                            {entry.note}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
                {(assignments || []).map((a: { id: string; note?: string; created_at: string; assignee?: { full_name?: string }; department?: { name?: string }; assigner?: { full_name?: string } }) => (
                  <div key={a.id} className="text-xs text-[#4A4640] pl-5 border-l border-[#CCC5BD]">
                    Assigned to <span className="font-medium text-[#1C1C18]">{(Array.isArray(a.assignee) ? a.assignee[0] : a.assignee)?.full_name || '—'}</span>
                    {(Array.isArray(a.department) ? a.department[0] : a.department)?.name ? ` · ${(Array.isArray(a.department) ? a.department[0] : a.department)?.name}` : ''}
                    {' · '}<span className="font-mono text-[11px]">{formatDateTime(a.created_at)}</span>
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                ))}
                {(!history || history.length === 0) && <p className="text-xs text-[#7C766F]">No stage history yet.</p>}
              </div>
            </div>
          ),
        }}
      />
    </div>
  )
}
