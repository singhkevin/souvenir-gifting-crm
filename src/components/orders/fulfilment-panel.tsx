import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, formatDateTime, oneRelation } from '@/lib/utils'
import {
  DELIVERY_STATUS_LABELS,
  LINE_STAGE_LABELS,
  LINE_STAGE_STYLES,
  PO_STATUS_LABELS,
  PRINT_JOB_STATUS_LABELS,
  RUNNER_JOB_KIND_LABELS,
  RUNNER_JOB_STATUS_LABELS,
  linesAwaitingBranding,
} from '@/lib/orders/line-lifecycle'
import { loadLifecycleSettings, signedProofUrls } from '@/lib/orders/line-lifecycle-server'
import {
  assignRunnerJob,
  cancelOrderLine,
  completeDeliveryAction,
  createDeliveryAction,
  createPurchaseOrder,
  givePrintGoAhead,
  markPrintReady,
  planOrderLine,
  recordBrandingApproval,
  releaseRunnerJob,
  setPurchaseOrderStatus,
} from '@/app/crm/orders/fulfilment-actions'
import { ActionButton } from '@/components/ui/action-button'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

const card = 'bg-[#FCF9F2] border border-[#CCC5BD] rounded-none'
const cardHead = 'bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between gap-3'
const h3 = 'font-[family-name:var(--font-newsreader)] text-lg font-normal text-[#1C1C18]'
const label = 'block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]'
const input = 'w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-1.5 text-xs text-[#1C1C18] focus:border-[#1C1B1A] focus:outline-none'
const btn = 'bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors rounded-none text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-2'
const btnGhost = 'border border-[#CCC5BD] text-[#1C1C18] hover:border-[#9E4300] hover:text-[#9E4300] rounded-none text-[11px] font-bold uppercase tracking-[0.12em] px-3 py-1.5'
const muted = 'text-xs text-[#7C766F]'

type Line = {
  id: string
  description: string | null
  quantity: number
  stage: string
  needs_branding: boolean
  fulfil_source: string | null
  supplier_id: string | null
  supplier_offer_id: string | null
  printing_vendor_id: string | null
  unit_cost: number | null
  qty_delivered: number
  count_issue: string | null
  product_id: string | null
  product: { name: string | null; sku: string | null } | { name: string | null; sku: string | null }[] | null
}

type Named = { id: string; name: string }

function lineName(line: Line) {
  const product = oneRelation(line.product)
  return product?.name || line.description || 'Product'
}

function StageChip({ stage }: { stage: string }) {
  return (
    <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${LINE_STAGE_STYLES[stage] || 'border-[#CCC5BD]'}`}>
      {LINE_STAGE_LABELS[stage] || stage}
    </span>
  )
}

/**
 * Line-level fulfilment for one order (needs migration 20261023_order_line_lifecycle.sql).
 * Each product line moves on its own: plan → PO / pickup → printer → packing → delivery.
 */
export async function FulfilmentPanel({
  orderId,
  role,
  showCosts,
  approvalStatus,
  approvalNote,
}: {
  orderId: string
  role: string
  showCosts: boolean
  approvalStatus: string | null
  approvalNote: string | null
}) {
  const supabase = await createClient()
  const canAct = role === 'admin' || role === 'operations'
  const canApprove = canAct || role === 'sales'

  const [linesRes, posRes, printRes, jobsRes, deliveriesRes, suppliersRes, vendorsRes, couriersRes, runnersRes, settings] =
    await Promise.all([
      supabase
        .from('order_items')
        .select('id, description, quantity, stage, needs_branding, fulfil_source, supplier_id, supplier_offer_id, printing_vendor_id, unit_cost, qty_delivered, count_issue, product_id, product:products(name, sku)')
        .eq('order_id', orderId)
        .order('id'),
      supabase
        .from('purchase_orders')
        .select('id, po_number, status, expected_date, sent_at, notes, supplier:suppliers(id, name), lines:purchase_order_lines(order_item_id, quantity, unit_cost)')
        .eq('order_id', orderId)
        .order('created_at'),
      supabase
        .from('print_jobs')
        .select('id, status, expected_ready_date, go_ahead_at, notes, vendor:printing_vendors(id, name), lines:print_job_lines(order_item_id, quantity)')
        .eq('order_id', orderId)
        .order('created_at'),
      supabase
        .from('runner_jobs')
        .select('id, kind, status, scheduled_for, from_label, to_label, notes, photo_path, completed_at, delivery_id, assignee:assigned_to(id, full_name), lines:runner_job_lines(order_item_id, expected_qty, counted_qty, damaged_qty, short_qty, note)')
        .eq('order_id', orderId)
        .order('created_at'),
      supabase
        .from('deliveries')
        .select('id, method, status, tracking_number, receiver_name, receiver_phone, signature_path, seal_photo_path, pod_path, delivered_at, created_at, courier:courier_partners(name), lines:delivery_lines(order_item_id, qty_sent, qty_delivered, short_qty, damaged_qty)')
        .eq('order_id', orderId)
        .order('created_at'),
      supabase.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      supabase.from('printing_vendors').select('id, name').eq('is_active', true).order('name'),
      supabase.from('courier_partners').select('id, name').eq('is_active', true).order('name'),
      supabase.from('profiles').select('id, full_name, role').in('role', ['runner', 'operations', 'admin']).eq('is_active', true).order('full_name'),
      loadLifecycleSettings(supabase),
    ])

  if (linesRes.error) {
    return <p className="text-xs text-[#BA1A1A]">Could not load product lines: {linesRes.error.message}</p>
  }
  const lines = (linesRes.data || []) as unknown as Line[]
  const lineById = new Map(lines.map((l) => [l.id, l]))
  const pos = posRes.data || []
  const printJobs = printRes.data || []
  const jobs = jobsRes.data || []
  const deliveries = deliveriesRes.data || []
  const suppliers = (suppliersRes.data || []) as Named[]
  const vendors = (vendorsRes.data || []) as Named[]
  const couriers = (couriersRes.data || []) as Named[]
  const people = (runnersRes.data || []) as { id: string; full_name: string; role: string }[]
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]))
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]))

  // Supplier offers for the products on lines still being planned.
  const planProducts = Array.from(new Set(lines.filter((l) => ['confirmed', 'sourcing'].includes(l.stage) && l.product_id).map((l) => l.product_id as string)))
  const offersByProduct = new Map<string, { id: string; supplier_id: string; cost: number | null; moq: number | null; lead_time_days: number | null; is_preferred: boolean; in_stock: boolean | null }[]>()
  if (planProducts.length) {
    const { data: offers } = await supabase
      .from('product_supplier_offers')
      .select('id, product_id, supplier_id, cost, moq, lead_time_days, is_preferred, in_stock')
      .in('product_id', planProducts)
      .eq('is_active', true)
    for (const o of offers || []) {
      const list = offersByProduct.get(o.product_id) || []
      list.push(o)
      offersByProduct.set(o.product_id, list)
    }
    for (const list of offersByProduct.values()) list.sort((a, b) => Number(b.is_preferred) - Number(a.is_preferred) || Number(a.cost ?? 0) - Number(b.cost ?? 0))
  }

  // Lines waiting for a PO: sourcing from a supplier and not on an open PO.
  const onActivePo = new Set<string>()
  for (const po of pos) {
    if (po.status === 'cancelled') continue
    for (const l of po.lines || []) onActivePo.add(l.order_item_id)
  }
  const needPo = new Map<string, Line[]>()
  for (const l of lines) {
    if (l.stage === 'sourcing' && l.fulfil_source === 'supplier' && l.supplier_id && !onActivePo.has(l.id)) {
      const list = needPo.get(l.supplier_id) || []
      list.push(l)
      needPo.set(l.supplier_id, list)
    }
  }

  const packing = lines.filter((l) => l.stage === 'packing')
  const awaitingBranding = linesAwaitingBranding(lines)
  const proofUrls = await signedProofUrls([
    ...jobs.map((j) => j.photo_path),
    ...deliveries.flatMap((d) => [d.signature_path, d.seal_photo_path, d.pod_path]),
  ])

  return (
    <div className="space-y-6 text-xs">
      {/* Lines */}
      <section className={card}>
        <div className={cardHead}>
          <h3 className={h3}>Product lines</h3>
          <span className={muted}>Each line moves on its own</span>
        </div>
        <ul className="divide-y divide-[#CCC5BD]">
          {lines.map((line) => {
            const offers = line.product_id ? offersByProduct.get(line.product_id) || [] : []
            const planning = canAct && ['confirmed', 'sourcing'].includes(line.stage) && !onActivePo.has(line.id)
            return (
              <li key={line.id} className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-[#1C1C18] text-sm">{lineName(line)}</div>
                    <div className={muted}>
                      Qty {line.quantity}
                      {line.qty_delivered > 0 ? ` · ${line.qty_delivered} delivered` : ''}
                      {line.fulfil_source ? ` · ${line.fulfil_source === 'stock' ? 'From stock' : `Supplier: ${supplierName.get(line.supplier_id || '') || '—'}`}` : ''}
                      {line.needs_branding ? ` · Branded${line.printing_vendor_id ? ` at ${vendorName.get(line.printing_vendor_id) || 'printer'}` : ''}` : ' · No branding'}
                      {showCosts && line.unit_cost != null ? ` · Cost ${formatCurrency(line.unit_cost)}` : ''}
                    </div>
                  </div>
                  <StageChip stage={line.stage} />
                </div>
                {line.count_issue ? (
                  <p className="border border-[#9E4300]/30 bg-[#FFB690]/20 px-2.5 py-1.5 text-[#9E4300]">Count issue: {line.count_issue}</p>
                ) : null}
                {planning ? (
                  <details className="border border-[#CCC5BD] bg-[#F6F3EC]">
                    <summary className="cursor-pointer px-3 py-2 font-semibold text-[#1C1C18]">
                      {line.stage === 'confirmed' ? 'Plan this line' : 'Change the plan'}
                    </summary>
                    <ActionForm action={planOrderLine} successMessage="Line planned" className="grid gap-3 p-3 sm:grid-cols-2">
                      <input type="hidden" name="order_id" value={orderId} />
                      <input type="hidden" name="order_item_id" value={line.id} />
                      <label className="space-y-1">
                        <span className={label}>Source</span>
                        <select name="fulfil_source" defaultValue={line.fulfil_source || (offers.length ? 'supplier' : 'stock')} className={input}>
                          <option value="stock">From our stock</option>
                          <option value="supplier">Buy from a supplier</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className={label}>Branding</span>
                        <select name="needs_branding" defaultValue={line.needs_branding ? 'yes' : 'no'} className={input}>
                          <option value="yes">Needs branding (printer)</option>
                          <option value="no">No branding</option>
                        </select>
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className={label}>Supplier offer</span>
                        <select name="supplier_offer_id" defaultValue={line.supplier_offer_id || ''} className={input}>
                          <option value="">No offer (choose a supplier below)</option>
                          {offers.map((o) => (
                            <option key={o.id} value={o.id}>
                              {supplierName.get(o.supplier_id) || 'Supplier'}
                              {showCosts && o.cost != null ? ` · ${formatCurrency(o.cost)}` : ''}
                              {o.moq ? ` · MOQ ${o.moq}` : ''}
                              {o.lead_time_days != null ? ` · ${o.lead_time_days} days` : ''}
                              {o.is_preferred ? ' · preferred' : ''}
                              {o.in_stock === false ? ' · out of stock' : ''}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className={label}>Other supplier</span>
                        <select name="supplier_id" defaultValue={line.supplier_id || ''} className={input}>
                          <option value="">—</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className={label}>Printer</span>
                        <select name="printing_vendor_id" defaultValue={line.printing_vendor_id || ''} className={input}>
                          <option value="">—</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </label>
                      {showCosts ? (
                        <label className="space-y-1">
                          <span className={label}>Unit cost (blank = offer cost)</span>
                          <input name="unit_cost" type="number" min="0" step="0.01" defaultValue={line.unit_cost ?? ''} className={input} />
                        </label>
                      ) : null}
                      <div className="sm:col-span-2">
                        <SubmitButton className={btn} pendingLabel="Saving…">Save plan</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                ) : null}
                {canAct && !['delivered', 'cancelled', 'out_for_delivery'].includes(line.stage) ? (
                  <details>
                    <summary className="cursor-pointer text-[11px] text-[#7C766F] hover:text-[#BA1A1A]">Cancel this line</summary>
                    <ActionForm action={cancelOrderLine} successMessage="Line cancelled" className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="order_id" value={orderId} />
                      <input type="hidden" name="order_item_id" value={line.id} />
                      <input name="reason" required placeholder="Reason" className={`${input} max-w-xs`} />
                      <SubmitButton className={btnGhost} pendingLabel="Cancelling…">Cancel line</SubmitButton>
                    </ActionForm>
                  </details>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {/* Branding approval gate */}
      {awaitingBranding.length > 0 || approvalStatus ? (
        <section className={card}>
          <div className={cardHead}>
            <h3 className={h3}>Branding approval</h3>
            <span className={muted}>
              {approvalStatus === 'approved' ? 'Approved' : approvalStatus === 'changes_requested' ? 'Changes requested' : 'Waiting'}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-[#4A4640]">
              The printer only gets the go-ahead after the client approves the mockup.
              {settings.early_branding_approval ? ' The client can approve early, before goods reach the printer.' : ''}
              {approvalNote ? ` Note: ${approvalNote}` : ''}
            </p>
            {canApprove && approvalStatus !== 'approved' ? (
              <ActionForm action={recordBrandingApproval} successMessage="Saved" className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="order_id" value={orderId} />
                <label className="space-y-1">
                  <span className={label}>Decision (from the client)</span>
                  <select name="decision" className={input} defaultValue="approved">
                    <option value="approved">Client approved</option>
                    <option value="changes_requested">Client asked for changes</option>
                  </select>
                </label>
                <input name="note" placeholder="How did they confirm? (email, call…)" className={`${input} max-w-sm`} />
                <SubmitButton className={btn} pendingLabel="Saving…">Record</SubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* Purchase orders */}
      <section className={card}>
        <div className={cardHead}>
          <h3 className={h3}>Purchase orders</h3>
          <span className={muted}>{pos.length} raised</span>
        </div>
        <div className="p-4 space-y-4">
          {canAct && needPo.size > 0
            ? Array.from(needPo.entries()).map(([supplierId, list]) => (
                <ActionForm key={supplierId} action={createPurchaseOrder} successMessage="Purchase order created" className="border border-dashed border-[#9E4300]/50 p-3 space-y-2">
                  <input type="hidden" name="order_id" value={orderId} />
                  <input type="hidden" name="supplier_id" value={supplierId} />
                  <div className="font-semibold text-[#1C1C18]">New PO · {supplierName.get(supplierId) || 'Supplier'}</div>
                  {list.map((l) => (
                    <label key={l.id} className="flex items-center gap-2">
                      <input type="checkbox" name="order_item_id" value={l.id} defaultChecked />
                      {lineName(l)} · {l.quantity}
                      {showCosts && l.unit_cost != null ? ` · ${formatCurrency(l.unit_cost)}` : ''}
                    </label>
                  ))}
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="space-y-1">
                      <span className={label}>Expected</span>
                      <input type="date" name="expected_date" className={input} />
                    </label>
                    <input name="notes" placeholder="Notes for the supplier" className={`${input} max-w-sm`} />
                    <SubmitButton className={btn} pendingLabel="Creating…">Create PO</SubmitButton>
                  </div>
                </ActionForm>
              ))
            : null}
          {pos.length === 0 ? <p className={muted}>No purchase orders yet.</p> : null}
          {pos.map((po) => {
            const supplier = oneRelation(po.supplier)
            return (
              <div key={po.id} className="border border-[#CCC5BD] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-[#1C1C18]">{po.po_number}</span>
                    <span className="text-[#4A4640]"> · {supplier?.name || 'Supplier'}</span>
                    {po.expected_date ? <span className={muted}> · expected {formatDate(po.expected_date)}</span> : null}
                  </div>
                  <span className="font-bold uppercase tracking-[0.1em] text-[10px] text-[#9E4300]">{PO_STATUS_LABELS[po.status] || po.status}</span>
                </div>
                <ul className={muted}>
                  {(po.lines || []).map((l) => (
                    <li key={l.order_item_id}>
                      {lineById.get(l.order_item_id) ? lineName(lineById.get(l.order_item_id)!) : 'Line'} · {l.quantity}
                      {showCosts && l.unit_cost != null ? ` · ${formatCurrency(l.unit_cost)}` : ''}
                    </li>
                  ))}
                </ul>
                {canAct ? (
                  <div className="flex flex-wrap gap-2">
                    {po.status === 'draft' ? (
                      <ActionButton action={setPurchaseOrderStatus.bind(null, orderId, po.id, 'sent')} className={btn} pendingLabel="Saving…" successMessage="PO marked as sent">
                        Mark as sent
                      </ActionButton>
                    ) : null}
                    {po.status === 'sent' ? (
                      <ActionButton action={setPurchaseOrderStatus.bind(null, orderId, po.id, 'ready')} className={btn} pendingLabel="Saving…" successMessage="Pickup job created">
                        Goods ready · create pickup
                      </ActionButton>
                    ) : null}
                    {['draft', 'sent'].includes(po.status) ? (
                      <ActionButton action={setPurchaseOrderStatus.bind(null, orderId, po.id, 'cancelled')} className={btnGhost} pendingLabel="Cancelling…" successMessage="PO cancelled">
                        Cancel PO
                      </ActionButton>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Print jobs */}
      {printJobs.length > 0 ? (
        <section className={card}>
          <div className={cardHead}>
            <h3 className={h3}>Printer</h3>
          </div>
          <div className="p-4 space-y-3">
            {printJobs.map((pj) => {
              const vendor = oneRelation(pj.vendor)
              return (
                <div key={pj.id} className="border border-[#CCC5BD] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#1C1C18]">{vendor?.name || 'Printer not chosen'}</span>
                      {pj.expected_ready_date ? <span className={muted}> · ready by {formatDate(pj.expected_ready_date)}</span> : null}
                      {pj.go_ahead_at ? <span className={muted}> · go-ahead {formatDateTime(pj.go_ahead_at)}</span> : null}
                    </div>
                    <span className="font-bold uppercase tracking-[0.1em] text-[10px] text-[#9E4300]">{PRINT_JOB_STATUS_LABELS[pj.status] || pj.status}</span>
                  </div>
                  <ul className={muted}>
                    {(pj.lines || []).map((l) => {
                      const line = lineById.get(l.order_item_id)
                      return (
                        <li key={l.order_item_id}>
                          {line ? lineName(line) : 'Line'} · {l.quantity} · {line ? LINE_STAGE_LABELS[line.stage] || line.stage : ''}
                        </li>
                      )
                    })}
                  </ul>
                  {canAct && pj.status === 'pending' ? (
                    approvalStatus === 'approved' ? (
                      <ActionForm action={givePrintGoAhead} successMessage="Go-ahead given" className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="order_id" value={orderId} />
                        <input type="hidden" name="print_job_id" value={pj.id} />
                        <label className="space-y-1">
                          <span className={label}>Ready by</span>
                          <input type="date" name="expected_ready" className={input} />
                        </label>
                        <input name="note" placeholder="Note for the printer" className={`${input} max-w-sm`} />
                        <SubmitButton className={btn} pendingLabel="Saving…">Give go-ahead</SubmitButton>
                      </ActionForm>
                    ) : (
                      <p className="text-[#9E4300]">Go-ahead unlocks once the client approves the branding.</p>
                    )
                  ) : null}
                  {canAct && pj.status === 'go_ahead' ? (
                    <ActionButton action={markPrintReady.bind(null, orderId, pj.id)} className={btn} pendingLabel="Saving…" successMessage="Pickup job created">
                      Printing done · create pickup
                    </ActionButton>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {/* Runner jobs */}
      <section className={card}>
        <div className={cardHead}>
          <h3 className={h3}>Runner jobs</h3>
          <span className={muted}>Pickups, handovers and deliveries</span>
        </div>
        <div className="p-4 space-y-3">
          {jobs.length === 0 ? <p className={muted}>No runner jobs yet.</p> : null}
          {jobs.map((job) => {
            const assignee = oneRelation(job.assignee)
            const open = !['done', 'cancelled'].includes(job.status)
            return (
              <div key={job.id} className="border border-[#CCC5BD] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[#1C1C18]">{RUNNER_JOB_KIND_LABELS[job.kind] || job.kind}</span>
                    {job.from_label || job.to_label ? (
                      <span className={muted}> · {job.from_label || '—'} → {job.to_label || '—'}</span>
                    ) : null}
                    {job.scheduled_for ? <span className={muted}> · {formatDate(job.scheduled_for)}</span> : null}
                  </div>
                  <span className="font-bold uppercase tracking-[0.1em] text-[10px] text-[#9E4300]">
                    {RUNNER_JOB_STATUS_LABELS[job.status] || job.status}
                    {assignee?.full_name ? ` · ${assignee.full_name}` : ''}
                  </span>
                </div>
                <ul className={muted}>
                  {(job.lines || []).map((l) => {
                    const line = lineById.get(l.order_item_id)
                    return (
                      <li key={l.order_item_id}>
                        {line ? lineName(line) : 'Line'} · expected {l.expected_qty}
                        {l.counted_qty != null ? ` · counted ${l.counted_qty}` : ''}
                        {l.short_qty ? ` · short ${l.short_qty}` : ''}
                        {l.damaged_qty ? ` · damaged ${l.damaged_qty}` : ''}
                        {l.note ? ` · ${l.note}` : ''}
                      </li>
                    )
                  })}
                </ul>
                {job.photo_path && proofUrls[job.photo_path] ? (
                  <a href={proofUrls[job.photo_path]} target="_blank" rel="noreferrer" className="text-[#9E4300] underline">Photo</a>
                ) : null}
                {canAct && open ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <ActionForm action={assignRunnerJob} successMessage="Runner assigned" className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="order_id" value={orderId} />
                      <input type="hidden" name="job_id" value={job.id} />
                      <select name="assigned_to" defaultValue={assignee?.id || ''} className={`${input} max-w-[14rem]`}>
                        <option value="">Choose who goes</option>
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.full_name}
                            {p.role === 'runner' ? '' : ` · ${p.role}`}
                          </option>
                        ))}
                      </select>
                      <input type="date" name="scheduled_for" defaultValue={job.scheduled_for || ''} className={`${input} max-w-[10rem]`} />
                      <SubmitButton className={btn} pendingLabel="Saving…">{assignee ? 'Reassign' : 'Assign'}</SubmitButton>
                    </ActionForm>
                    {assignee ? (
                      <ActionForm action={releaseRunnerJob} successMessage="Job unassigned">
                        <input type="hidden" name="order_id" value={orderId} />
                        <input type="hidden" name="job_id" value={job.id} />
                        <input type="hidden" name="reason" value="Unassigned by operations" />
                        <SubmitButton className={btnGhost} pendingLabel="Saving…">Unassign</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Deliveries */}
      <section className={card}>
        <div className={cardHead}>
          <h3 className={h3}>Deliveries</h3>
          <span className={muted}>{settings.allow_partial_delivery ? 'Part deliveries allowed' : 'Whole order only'}</span>
        </div>
        <div className="p-4 space-y-4">
          {canAct && packing.length > 0 ? (
            <ActionForm action={createDeliveryAction} successMessage="Delivery created" className="border border-dashed border-[#9E4300]/50 p-3 space-y-3">
              <input type="hidden" name="order_id" value={orderId} />
              <div className="font-semibold text-[#1C1C18]">Send packed lines</div>
              {packing.map((l) => {
                const remaining = Math.max(0, Number(l.quantity) - Number(l.qty_delivered || 0))
                return (
                  <div key={l.id} className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 min-w-[12rem]">
                      <input type="checkbox" name="deliver_id" value={l.id} defaultChecked />
                      {lineName(l)}
                    </label>
                    <input
                      type="number"
                      name={`qty_${l.id}`}
                      min={1}
                      max={remaining}
                      defaultValue={remaining}
                      readOnly={!settings.allow_partial_delivery}
                      className={`${input} max-w-[6rem]`}
                    />
                    <span className={muted}>of {remaining} left</span>
                  </div>
                )
              })}
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className={label}>How</span>
                  <select name="method" defaultValue="runner" className={input}>
                    <option value="runner">Our runner</option>
                    <option value="courier">Courier</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={label}>Runner (if runner)</span>
                  <select name="runner_id" defaultValue="" className={input}>
                    <option value="">Assign later</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={label}>Courier (if courier)</span>
                  <select name="courier_partner_id" defaultValue="" className={input}>
                    <option value="">—</option>
                    {couriers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className={label}>Tracking / AWB</span>
                  <input name="tracking_number" className={input} />
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className={label}>Address (blank = order address)</span>
                  <input name="address" className={input} />
                </label>
                <label className="space-y-1">
                  <span className={label}>Receiver phone</span>
                  <input name="contact_phone" className={input} />
                </label>
              </div>
              <SubmitButton className={btn} pendingLabel="Creating…">Create delivery</SubmitButton>
            </ActionForm>
          ) : null}
          {deliveries.length === 0 ? <p className={muted}>No deliveries yet.</p> : null}
          {deliveries.map((d) => {
            const courier = oneRelation(d.courier)
            const job = jobs.find((j) => j.delivery_id === d.id)
            return (
              <div key={d.id} className="border border-[#CCC5BD] p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-[#1C1C18]">
                      {d.method === 'runner' ? 'Runner' : courier?.name || 'Courier'}
                    </span>
                    {d.tracking_number ? <span className="font-mono text-[#4A4640]"> · {d.tracking_number}</span> : null}
                    <span className={muted}> · {formatDateTime(d.delivered_at || d.created_at)}</span>
                  </div>
                  <span className="font-bold uppercase tracking-[0.1em] text-[10px] text-[#9E4300]">{DELIVERY_STATUS_LABELS[d.status] || d.status}</span>
                </div>
                <ul className={muted}>
                  {(d.lines || []).map((l) => {
                    const line = lineById.get(l.order_item_id)
                    return (
                      <li key={l.order_item_id}>
                        {line ? lineName(line) : 'Line'} · sent {l.qty_sent}
                        {l.qty_delivered != null ? ` · received ${l.qty_delivered}` : ''}
                        {l.short_qty ? ` · short ${l.short_qty}` : ''}
                        {l.damaged_qty ? ` · damaged ${l.damaged_qty}` : ''}
                      </li>
                    )
                  })}
                </ul>
                {d.receiver_name ? (
                  <p className="text-[#4A4640]">
                    Received by {d.receiver_name}
                    {d.receiver_phone ? ` · ${d.receiver_phone}` : ''}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      ['Signature', d.signature_path],
                      ['Seal / challan', d.seal_photo_path],
                      ['POD', d.pod_path],
                    ] as const
                  ).map(([name, path]) =>
                    path && proofUrls[path] ? (
                      <a key={name} href={proofUrls[path]} target="_blank" rel="noreferrer" className="text-[#9E4300] underline">
                        {name}
                      </a>
                    ) : null,
                  )}
                </div>
                {canAct && d.status === 'out' ? (
                  <details className="border border-[#CCC5BD] bg-[#F6F3EC]">
                    <summary className="cursor-pointer px-3 py-2 font-semibold text-[#1C1C18]">Record delivery</summary>
                    <ActionForm action={completeDeliveryAction} successMessage="Delivery recorded" className="grid gap-2 p-3 sm:grid-cols-2">
                      <input type="hidden" name="delivery_id" value={d.id} />
                      {job ? <input type="hidden" name="job_id" value={job.id} /> : null}
                      {(d.lines || []).map((l) => {
                        const line = lineById.get(l.order_item_id)
                        return (
                          <div key={l.order_item_id} className="sm:col-span-2 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="line_id" value={l.order_item_id} />
                            <span className="min-w-[10rem]">{line ? lineName(line) : 'Line'} · sent {l.qty_sent}</span>
                            <label className="flex items-center gap-1">
                              Received
                              <input type="number" name={`counted_${l.order_item_id}`} min={0} max={l.qty_sent} defaultValue={l.qty_sent} className={`${input} w-20`} />
                            </label>
                            <label className="flex items-center gap-1">
                              Damaged
                              <input type="number" name={`damaged_${l.order_item_id}`} min={0} defaultValue={0} className={`${input} w-20`} />
                            </label>
                          </div>
                        )
                      })}
                      <input name="receiver_name" placeholder="Receiver name" className={input} />
                      <input name="receiver_phone" placeholder="Receiver phone" className={input} />
                      {d.method === 'runner' ? (
                        <>
                          <label className="space-y-1">
                            <span className={label}>Signature image{settings.require_signature ? ' *' : ''}</span>
                            <input type="file" name="signature" accept="image/*" className="text-xs" />
                          </label>
                          <label className="space-y-1">
                            <span className={label}>Seal / challan photo{settings.require_seal_photo ? ' *' : ''}</span>
                            <input type="file" name="seal_photo" accept="image/*" capture="environment" className="text-xs" />
                          </label>
                        </>
                      ) : (
                        <label className="space-y-1 sm:col-span-2">
                          <span className={label}>Courier POD (optional)</span>
                          <input type="file" name="pod" accept="image/*" className="text-xs" />
                        </label>
                      )}
                      <input name="note" placeholder="Note" className={`${input} sm:col-span-2`} />
                      <div className="sm:col-span-2">
                        <SubmitButton className={btn} pendingLabel="Saving…">Save delivery</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
