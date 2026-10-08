'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { withIdempotency } from '@/lib/idempotency'

const TASK_STATUSES = ['open', 'in_progress', 'blocked', 'done', 'cancelled'] as const

function revalidateTaskSurfaces(orderId?: string | null, companyId?: string | null) {
  revalidatePath('/crm/tasks')
  revalidatePath('/crm/my-work')
  revalidatePath('/crm/tracking')
  if (orderId) revalidatePath(`/crm/orders/${orderId}`)
  if (companyId) revalidatePath(`/crm/companies/${companyId}`)
}

function canManageAllTasks(role: string) {
  return role === 'admin' || role === 'operations' || role === 'management'
}

export async function createTask(formData: FormData) {
  return withIdempotency('crm.createTask', formData, () => createTaskOnce(formData))
}

async function createTaskOnce(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const title = String(formData.get('title') || '').trim()
  if (!title) return { error: 'Title is required' }

  const assignedTo = String(formData.get('assigned_to') || '') || profile.id
  const orderId = String(formData.get('order_id') || '') || null
  let companyId = String(formData.get('company_id') || '') || null
  if (orderId && !companyId) {
    const { data: order } = await supabase.from('orders').select('company_id').eq('id', orderId).maybeSingle()
    companyId = order?.company_id || null
  }

  const { data, error } = await supabase.from('tasks').insert({
    title,
    description: String(formData.get('description') || '') || null,
    assigned_to: assignedTo,
    created_by: profile.id,
    due_at: String(formData.get('due_at') || '') || null,
    priority: Number(formData.get('priority') || 2),
    status: 'open',
    order_id: orderId,
    company_id: companyId,
  }).select('id').single()
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'create',
    entity: 'tasks',
    entityId: data.id,
    next: { title, assigned_to: assignedTo, order_id: orderId, company_id: companyId },
    userId: profile.id,
  })
  revalidateTaskSurfaces(orderId, companyId)
  return { success: true }
}

export async function completeTask(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const supabase = await createClient()
  const id = String(formData.get('id') || '')
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, created_by, order_id, company_id')
    .eq('id', id)
    .maybeSingle()
  if (!task) return { error: 'Task not found' }
  const allowed =
    canManageAllTasks(profile.role) ||
    task.assigned_to === profile.id ||
    task.created_by === profile.id
  if (!allowed) return { error: 'Not permitted to complete this task' }

  const { error } = await supabase.from('tasks').update({
    status: 'done',
    completed_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateTaskSurfaces(task.order_id, task.company_id)
  return { success: true }
}

export async function updateTaskStatus(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const status = String(formData.get('status') || '')
  if (!TASK_STATUSES.includes(status as (typeof TASK_STATUSES)[number])) {
    return { error: 'Invalid task status' }
  }

  const supabase = await createClient()
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to, created_by, order_id, company_id')
    .eq('id', id)
    .maybeSingle()
  if (!task) return { error: 'Task not found' }
  const allowed =
    canManageAllTasks(profile.role) ||
    task.assigned_to === profile.id ||
    task.created_by === profile.id
  if (!allowed) return { error: 'Not permitted to update this task' }

  const { error } = await supabase.from('tasks').update({
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidateTaskSurfaces(task.order_id, task.company_id)
  return { success: true }
}

export async function reassignTask(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.role !== 'admin' && profile.role !== 'management' && profile.role !== 'operations') {
    return { error: 'Not permitted to reassign tasks' }
  }

  const id = String(formData.get('id') || '')
  const assignedTo = String(formData.get('assigned_to') || '')
  if (!id || !assignedTo) return { error: 'Task and assignee are required' }

  const supabase = await createClient()
  const { data: task } = await supabase.from('tasks').select('order_id, company_id, assigned_to').eq('id', id).maybeSingle()
  if (!task) return { error: 'Task not found' }

  const { error } = await supabase.from('tasks').update({ assigned_to: assignedTo }).eq('id', id)
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'assignment_change',
    entity: 'tasks',
    entityId: id,
    previous: { assigned_to: task.assigned_to },
    next: { assigned_to: assignedTo },
    userId: profile.id,
  })
  revalidateTaskSurfaces(task.order_id, task.company_id)
  return { success: true }
}
