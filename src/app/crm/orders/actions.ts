'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile, canChangeOrderStage, canSeeCosts, isOpsStaff } from '@/lib/auth'
import { canAdvanceTo, nextLifecycleStatus, ORDER_STATUS_LABELS, STAGE_DEPARTMENT } from '@/lib/order-workflow'

function redirectStageError(orderId: string, message: string): never {
  const text = message.replace(/\s+/g, ' ').slice(0, 300)
  redirect(`/crm/orders/${orderId}?stage_error=${encodeURIComponent(text)}`)
}

export async function advanceOrderStatus(orderId: string, comment?: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canChangeOrderStage(profile.role)) return { error: 'Not permitted to change order stages' }

  const supabase = await createClient()
  const { data: order, error: loadError } = await supabase
    .from('orders')
    .select('id, status, client_approval_status')
    .eq('id', orderId)
    .single()
  if (loadError) return { error: loadError.message }
  if (!order) return { error: 'Order not found' }
  const next = nextLifecycleStatus(order.status)
  if (!next) return { error: 'Order is already at a terminal stage' }
  const gate = canAdvanceTo(order.status, next, order.client_approval_status)
  if (!gate.ok) redirectStageError(orderId, gate.reason)

  const { data: dept } = await supabase.from('departments').select('id, manager_id').eq('slug', STAGE_DEPARTMENT[next] || 'operations').maybeSingle()

  const { error } = await supabase.rpc('advance_order_stage', {
    p_order_id: orderId,
    p_status: next,
    p_assigned_to: dept?.manager_id || null,
    p_department_id: dept?.id || null,
    p_comment: comment || `Advanced to ${ORDER_STATUS_LABELS[next] || next}`,
  })
  if (error) redirectStageError(orderId, error.message)
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/dashboard')
  revalidatePath('/crm/my-work')
  redirect(`/crm/orders/${orderId}`)
}

export async function handOffOrder(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!canChangeOrderStage(profile.role)) return { error: 'Not permitted to change order stages' }

  const orderId = String(formData.get('order_id') || '')
  const status = String(formData.get('status') || '')
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
  if (loadError) redirectStageError(orderId, loadError.message)
  if (!order) redirectStageError(orderId, 'Order not found')
  const gate = canAdvanceTo(order.status, status, order.client_approval_status)
  if (!gate.ok) redirectStageError(orderId, gate.reason)

  const { error } = await supabase.rpc('advance_order_stage', {
    p_order_id: orderId,
    p_status: status,
    p_assigned_to: assignedTo,
    p_department_id: departmentId,
    p_comment: comment,
    p_stage_due: stageDue,
    p_next_action: nextAction,
  })
  if (error) redirectStageError(orderId, error.message)
  revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/department')
  revalidatePath('/crm/my-work')
  redirect(`/crm/orders/${orderId}`)
}

export async function setOrderStage(orderId: string, status: string) {
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
  if (order.status === status) return { success: true }
  const gate = canAdvanceTo(order.status, status, order.client_approval_status)
  if (!gate.ok) return { error: gate.reason }

  const { data: dept } = await supabase
    .from('departments')
    .select('id, manager_id')
    .eq('slug', STAGE_DEPARTMENT[status] || 'operations')
    .maybeSingle()

  const { error } = await supabase.rpc('advance_order_stage', {
    p_order_id: orderId,
    p_status: status,
    p_assigned_to: dept?.manager_id || null,
    p_department_id: dept?.id || null,
    p_comment: `Moved to ${ORDER_STATUS_LABELS[status] || status} from Order Control Kanban`,
  })
  if (error) return { error: error.message }
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
