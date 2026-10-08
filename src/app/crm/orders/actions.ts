'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getProfile, canChangeOrderStage, canSeeCosts, isOpsStaff } from '@/lib/auth'
import { canAdvanceTo, nextLifecycleStatus, ORDER_STATUS_LABELS, STAGE_DEPARTMENT } from '@/lib/order-workflow'

type AdvanceArgs = {
  orderId: string
  status: string
  expectedStatus?: string | null
  assignedTo?: string | null
  departmentId?: string | null
  comment?: string | null
  stageDue?: string | null
  nextAction?: string | null
}

function alreadyMovedMessage(current: string) {
  return `This order already moved to ${ORDER_STATUS_LABELS[current] || current}. Refresh to see the latest stage.`
}

function cleanError(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 300)
}

/**
 * advance_order_stage with the expected-stage guard (migration 20261007). The update only applies
 * while the order is still in `expectedStatus`; a second request for the same click fails with
 * "Order already moved" instead of advancing again. Falls back to the old signature when the
 * migration has not been applied yet.
 */
async function callAdvanceStage(supabase: SupabaseClient, args: AdvanceArgs): Promise<{ error?: string }> {
  const base = {
    p_order_id: args.orderId,
    p_status: args.status,
    p_assigned_to: args.assignedTo ?? null,
    p_department_id: args.departmentId ?? null,
    p_comment: args.comment ?? null,
    p_stage_due: args.stageDue ?? null,
    p_next_action: args.nextAction ?? null,
  }
  let { error } = await supabase.rpc('advance_order_stage', { ...base, p_expected_status: args.expectedStatus ?? null })
  if (error && args.expectedStatus && /p_expected_status|schema cache|could not find the function/i.test(error.message)) {
    ;({ error } = await supabase.rpc('advance_order_stage', base))
  }
  if (!error) return {}
  if (/already moved/i.test(error.message)) {
    const { data } = await supabase.from('orders').select('status').eq('id', args.orderId).maybeSingle()
    return { error: data?.status ? alreadyMovedMessage(String(data.status)) : cleanError(error.message) }
  }
  return { error: cleanError(error.message) }
}

export async function advanceOrderStatus(orderId: string, expectedStatus: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canChangeOrderStage(profile.role)) return { error: 'Not permitted to change order stages' }
  if (!orderId || !expectedStatus) return { error: 'Order is required' }

  const supabase = await createClient()
  const { data: order, error: loadError } = await supabase
    .from('orders')
    .select('id, status, client_approval_status')
    .eq('id', orderId)
    .single()
  if (loadError) return { error: loadError.message }
  if (!order) return { error: 'Order not found' }
  if (order.status !== expectedStatus) return { error: alreadyMovedMessage(order.status) }
  const next = nextLifecycleStatus(order.status)
  if (!next) return { error: 'Order is already at a terminal stage' }
  const gate = canAdvanceTo(order.status, next, order.client_approval_status)
  if (!gate.ok) return { error: gate.reason }

  const { data: dept } = await supabase.from('departments').select('id, manager_id').eq('slug', STAGE_DEPARTMENT[next] || 'operations').maybeSingle()

  const result = await callAdvanceStage(supabase, {
    orderId,
    status: next,
    expectedStatus,
    assignedTo: dept?.manager_id || null,
    departmentId: dept?.id || null,
    comment: `Advanced to ${ORDER_STATUS_LABELS[next] || next}`,
  })
  if (result.error) return result
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/my-work')
  return { success: true, message: `Advanced to ${ORDER_STATUS_LABELS[next] || next}` }
}

export async function handOffOrder(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canChangeOrderStage(profile.role)) return { error: 'Not permitted to change order stages' }

  const orderId = String(formData.get('order_id') || '')
  const status = String(formData.get('status') || '')
  const expectedStatus = String(formData.get('expected_status') || '') || null
  const departmentId = String(formData.get('department_id') || '') || null
  const assignedTo = String(formData.get('assigned_to') || '') || null
  const comment = String(formData.get('comment') || '') || null
  const stageDue = String(formData.get('stage_due') || '') || null
  const nextAction = String(formData.get('next_action') || '') || null

  if (!orderId || !status) return { error: 'Stage is required' }

  const supabase = await createClient()
  const { data: order, error: loadError } = await supabase
    .from('orders')
    .select('id, status, client_approval_status')
    .eq('id', orderId)
    .single()
  if (loadError) return { error: cleanError(loadError.message) }
  if (!order) return { error: 'Order not found' }
  if (expectedStatus && order.status !== expectedStatus) return { error: alreadyMovedMessage(order.status) }
  const gate = canAdvanceTo(order.status, status, order.client_approval_status)
  if (!gate.ok) return { error: gate.reason }

  const result = await callAdvanceStage(supabase, {
    orderId,
    status,
    expectedStatus,
    assignedTo,
    departmentId,
    comment,
    stageDue,
    nextAction,
  })
  if (result.error) return result
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/department')
  revalidatePath('/crm/my-work')
  return { success: true, message: 'Stage updated' }
}

export async function setOrderStage(orderId: string, status: string, expectedStatus?: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canChangeOrderStage(profile.role)) return { error: 'Not permitted to change order stages' }

  const allowed = new Set([...Object.keys(STAGE_DEPARTMENT), 'cancelled'])
  if (!allowed.has(status)) return { error: 'Invalid stage' }

  const supabase = await createClient()
  const { data: order, error: loadError } = await supabase
    .from('orders')
    .select('id, status, client_approval_status')
    .eq('id', orderId)
    .single()
  if (loadError) return { error: loadError.message }
  if (!order) return { error: 'Order not found' }
  if (expectedStatus && order.status !== expectedStatus) return { error: alreadyMovedMessage(order.status) }
  if (order.status === status) return { success: true }
  const gate = canAdvanceTo(order.status, status, order.client_approval_status)
  if (!gate.ok) return { error: gate.reason }

  const { data: dept } = await supabase
    .from('departments')
    .select('id, manager_id')
    .eq('slug', STAGE_DEPARTMENT[status] || 'operations')
    .maybeSingle()

  const result = await callAdvanceStage(supabase, {
    orderId,
    status,
    expectedStatus: expectedStatus ?? order.status,
    assignedTo: dept?.manager_id || null,
    departmentId: dept?.id || null,
    comment: `Moved to ${ORDER_STATUS_LABELS[status] || status} from Order Control Kanban`,
  })
  if (result.error) return result
  revalidatePath('/crm/order-management')
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/my-work')
  revalidatePath('/crm/department')
  return { success: true }
}

export async function assignSupplier(orderId: string, supplierId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!isOpsStaff(profile.role)) return { error: 'Only operations or admin can assign vendors' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ supplier_id: supplierId || null })
    .eq('id', orderId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/orders/${orderId}`)
  return { success: true }
}

export async function assignSupplierForm(formData: FormData) {
  const orderId = String(formData.get('order_id') || '')
  if (!orderId) return { error: 'Order is required' }
  return assignSupplier(orderId, String(formData.get('supplier_id') || ''))
}

export async function assignCourierForm(formData: FormData) {
  const orderId = String(formData.get('order_id') || '')
  if (!orderId) return { error: 'Order is required' }
  return assignCourier(
    orderId,
    String(formData.get('courier_partner_id') || ''),
    String(formData.get('tracking_number') || '') || undefined,
  )
}

export async function assignPrintingVendor(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!isOpsStaff(profile.role)) return { error: 'Only operations or admin can assign vendors' }

  const orderId = String(formData.get('order_id') || '')
  if (!orderId) return { error: 'Order is required' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ printing_vendor_id: String(formData.get('printing_vendor_id') || '') || null })
    .eq('id', orderId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/orders/${orderId}`)
  return { success: true }
}

export async function assignCourier(orderId: string, courierId: string, trackingNumber?: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!isOpsStaff(profile.role)) return { error: 'Only operations or admin can record shipping' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ courier_partner_id: courierId || null, tracking_number: trackingNumber || null })
    .eq('id', orderId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/orders/${orderId}`)
  return { success: true }
}

export async function recordDelivery(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!isOpsStaff(profile.role)) return { error: 'Only operations or admin can record delivery dates' }

  const orderId = String(formData.get('order_id') || '')
  if (!orderId) return { error: 'Order is required' }

  const dispatchDate = String(formData.get('dispatch_date') || '') || null
  const expected = String(formData.get('expected_delivery_date') || '') || null
  const actual = String(formData.get('actual_delivery_date') || '') || null

  if (dispatchDate && actual && actual < dispatchDate) {
    return { error: 'Actual delivery cannot be earlier than the dispatch date' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      dispatch_date: dispatchDate,
      expected_delivery_date: expected,
      actual_delivery_date: actual,
    })
    .eq('id', orderId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  return { success: true }
}

export async function saveOrderCosting(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canSeeCosts(profile.role)) return { error: 'Not permitted to edit order costing' }

  const orderId = String(formData.get('order_id') || '')
  if (!orderId) return { error: 'Order is required' }

  const read = (key: string) => {
    const raw = formData.get(key)
    if (raw === null || String(raw).trim() === '') return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : NaN
  }

  const costs = {
    product_cost: read('product_cost'),
    printing_cost: read('printing_cost'),
    courier_cost: read('courier_cost'),
    other_cost: read('other_cost'),
  }
  if (Object.values(costs).some((v) => Number.isNaN(v))) {
    return { error: 'Costs must be zero or a positive number' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('orders').update(costs).eq('id', orderId)
  if (error) return { error: error.message }

  // total_cost and gross_profit are derived server-side, never sent by the client.
  const { error: recalcError } = await supabase.rpc('recalc_order_cost', { p_order_id: orderId })
  if (recalcError) return { error: recalcError.message }

  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/reports')
  return { success: true }
}
