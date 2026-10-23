'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile, isOpsStaff } from '@/lib/auth'
import { lifecycleEmailsOn } from '@/lib/orders/line-lifecycle-server'
import { ORDER_PROOFS_BUCKET } from '@/lib/orders/line-lifecycle'
import { isUuid } from '@/lib/utils'

type Result = { error?: string; success?: boolean; message?: string }

function str(fd: FormData, key: string) {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}
function opt(fd: FormData, key: string) {
  return str(fd, key) || null
}
function int(fd: FormData, key: string): number | null {
  const v = str(fd, key)
  if (v === '') return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}
function cleanError(message: string) {
  return message.replace(/\s+/g, ' ').slice(0, 300)
}

function revalidateOrder(orderId: string | null) {
  if (orderId) revalidatePath(`/crm/orders/${orderId}`)
  revalidatePath('/crm/order-management')
  revalidatePath('/crm/department')
  revalidatePath('/crm/my-work')
  revalidatePath('/crm/runs')
  revalidatePath('/crm/dashboard')
}

type Supa = Awaited<ReturnType<typeof createClient>>

async function orderStatus(supabase: Supa, orderId: string | null) {
  if (!orderId) return null
  const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle()
  return data?.status ? String(data.status) : null
}

/**
 * Runs one lifecycle RPC as the signed-in user (the database checks the role), then refreshes
 * the order screens. Customer stage emails for line-driven changes are off unless
 * ORDER_LIFECYCLE_EMAILS=on, so testing against live data never emails a client.
 */
async function runRpc(
  fn: string,
  args: Record<string, unknown>,
  orderId: string | null,
  message: string,
  options: { allowRunner?: boolean } = {},
): Promise<Result> {
  const profile = await getProfile()
  if (!profile || !profile.is_active) return { error: 'Not authenticated' }
  const allowed = isOpsStaff(profile.role) || (options.allowRunner && profile.role === 'runner')
  if (!allowed) return { error: 'Only operations or admin can do this' }
  const supabase = await createClient()
  const before = await orderStatus(supabase, orderId)
  const { error } = await supabase.rpc(fn, args)
  if (error) return { error: cleanError(error.message) }
  const after = await orderStatus(supabase, orderId)
  if (orderId && after && before !== after && lifecycleEmailsOn()) {
    const { orderStageChangedCustomerEmail } = await import('@/lib/email/order-emails')
    await orderStageChangedCustomerEmail(orderId, after === 'partly_delivered' ? 'dispatched' : after)
  }
  revalidateOrder(orderId)
  return { success: true, message }
}

// ---------------------------------------------------------------------------
// Planning and purchase orders.
// ---------------------------------------------------------------------------

export async function planOrderLine(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  const itemId = str(fd, 'order_item_id')
  const source = str(fd, 'fulfil_source')
  if (!isUuid(itemId)) return { error: 'Line is required' }
  const offerId = opt(fd, 'supplier_offer_id')
  const supplierId = opt(fd, 'supplier_id')
  const cost = str(fd, 'unit_cost')
  return runRpc(
    'plan_order_line',
    {
      p_item_id: itemId,
      p_source: source,
      p_needs_branding: str(fd, 'needs_branding') === 'yes',
      p_supplier_id: offerId ? null : supplierId,
      p_supplier_offer_id: offerId,
      p_printing_vendor_id: opt(fd, 'printing_vendor_id'),
      p_unit_cost: cost === '' ? null : Number(cost),
    },
    orderId,
    'Line planned',
  )
}

export async function createPurchaseOrder(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  const supplierId = str(fd, 'supplier_id')
  const itemIds = fd.getAll('order_item_id').map(String).filter(isUuid)
  if (!itemIds.length) return { error: 'Choose at least one line' }
  return runRpc(
    'create_purchase_order',
    {
      p_order_id: orderId,
      p_supplier_id: supplierId,
      p_item_ids: itemIds,
      p_expected_date: opt(fd, 'expected_date'),
      p_notes: opt(fd, 'notes'),
    },
    orderId,
    'Purchase order created',
  )
}

export async function setPurchaseOrderStatus(orderId: string, poId: string, status: string): Promise<Result> {
  const labels: Record<string, string> = { sent: 'PO marked as sent', ready: 'Supplier pickup job created', cancelled: 'PO cancelled' }
  return runRpc('set_purchase_order_status', { p_po_id: poId, p_status: status, p_note: null }, orderId, labels[status] || 'PO updated')
}

// ---------------------------------------------------------------------------
// Printer.
// ---------------------------------------------------------------------------

export async function givePrintGoAhead(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  return runRpc(
    'give_print_go_ahead',
    { p_print_job_id: str(fd, 'print_job_id'), p_expected_ready: opt(fd, 'expected_ready'), p_note: opt(fd, 'note') },
    orderId,
    'Printer go-ahead given',
  )
}

export async function markPrintReady(orderId: string, printJobId: string): Promise<Result> {
  return runRpc('mark_print_ready', { p_print_job_id: printJobId, p_note: null }, orderId, 'Printer pickup job created')
}

export async function recordBrandingApproval(fd: FormData): Promise<Result> {
  const profile = await getProfile()
  if (!profile || !['admin', 'sales', 'operations'].includes(profile.role)) return { error: 'Not permitted' }
  const orderId = str(fd, 'order_id')
  const decision = str(fd, 'decision')
  const supabase = await createClient()
  const { error } = await supabase.rpc('record_branding_approval', {
    p_order_id: orderId,
    p_decision: decision,
    p_note: opt(fd, 'note'),
  })
  if (error) return { error: cleanError(error.message) }
  revalidateOrder(orderId)
  return { success: true, message: decision === 'approved' ? 'Branding approval recorded' : 'Changes requested' }
}

// ---------------------------------------------------------------------------
// Runner jobs.
// ---------------------------------------------------------------------------

export async function assignRunnerJob(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  const userId = str(fd, 'assigned_to')
  if (!isUuid(userId)) return { error: 'Choose who goes' }
  return runRpc(
    'assign_runner_job',
    { p_job_id: str(fd, 'job_id'), p_user_id: userId, p_scheduled_for: opt(fd, 'scheduled_for'), p_note: opt(fd, 'note') },
    orderId,
    'Runner assigned',
  )
}

/** A runner hands a job back (e.g. cannot go); ops get a task to reassign it. */
export async function releaseRunnerJob(fd: FormData): Promise<Result> {
  const orderId = opt(fd, 'order_id')
  return runRpc(
    'release_runner_job',
    { p_job_id: str(fd, 'job_id'), p_reason: opt(fd, 'reason') },
    orderId,
    'Job handed back',
    { allowRunner: true },
  )
}

export async function startRunnerJob(orderId: string | null, jobId: string): Promise<Result> {
  return runRpc('start_runner_job', { p_job_id: jobId }, orderId, 'Marked as on the way', { allowRunner: true })
}

// ---------------------------------------------------------------------------
// Proof uploads (private bucket; service role after the caller is checked).
// ---------------------------------------------------------------------------

const MAX_PROOF_BYTES = 6 * 1024 * 1024
const PROOF_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

async function uploadProof(
  file: FormDataEntryValue | null,
  orderId: string,
  folder: string,
  label: string,
): Promise<{ path: string | null; error?: string }> {
  if (!file || typeof file === 'string' || file.size === 0) return { path: null }
  const ext = PROOF_TYPES[file.type]
  if (!ext) return { path: null, error: `${label} must be a JPG, PNG or WebP image` }
  if (file.size > MAX_PROOF_BYTES) return { path: null, error: `${label} is larger than 6 MB` }
  const admin = createAdminClient()
  if (!admin) return { path: null, error: 'File storage is not configured' }
  const path = `${orderId}/${folder}/${label.toLowerCase().replace(/[^a-z]+/g, '-')}-${Date.now()}.${ext}`
  const { error } = await admin.storage
    .from(ORDER_PROOFS_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return { path: null, error: cleanError(`${label} upload failed: ${error.message}`) }
  return { path }
}

/** Loads a runner job the caller may act on (RLS: ops see all, runners see their own). */
async function loadActionableJob(jobId: string) {
  const profile = await getProfile()
  if (!profile || !profile.is_active) return { error: 'Not authenticated' as const }
  if (!(isOpsStaff(profile.role) || profile.role === 'runner')) return { error: 'Not permitted' as const }
  const supabase = await createClient()
  const { data: job } = await supabase
    .from('runner_jobs')
    .select('id, order_id, kind, status, assigned_to, delivery_id')
    .eq('id', jobId)
    .maybeSingle()
  if (!job) return { error: 'Job not found' as const }
  if (profile.role === 'runner' && job.assigned_to !== profile.id) return { error: 'Not your job' as const }
  return { profile, supabase, job }
}

function countsFrom(fd: FormData) {
  const ids = fd.getAll('line_id').map(String).filter(isUuid)
  return ids.map((id) => ({
    order_item_id: id,
    counted: int(fd, `counted_${id}`) ?? 0,
    delivered: int(fd, `counted_${id}`) ?? 0,
    damaged: int(fd, `damaged_${id}`) ?? 0,
    note: str(fd, `note_${id}`) || null,
  }))
}

/** Pickup / handover: counts per line, optional photo. */
export async function completeRunnerJob(fd: FormData): Promise<Result> {
  const jobId = str(fd, 'job_id')
  if (!isUuid(jobId)) return { error: 'Job is required' }
  const loaded = await loadActionableJob(jobId)
  if ('error' in loaded) return { error: loaded.error }
  const { supabase, job, profile } = loaded
  if (job.kind === 'delivery') return { error: 'Use the delivery form for deliveries' }
  const counts = countsFrom(fd)
  if (!counts.length) return { error: 'Enter the count for each product' }
  const photo = await uploadProof(fd.get('photo'), job.order_id, `job-${job.id}`, 'Photo')
  if (photo.error) return { error: photo.error }
  const { error } = await supabase.rpc('complete_runner_job', {
    p_job_id: jobId,
    p_counts: counts.map(({ order_item_id, counted, damaged, note }) => ({ order_item_id, counted, damaged, note })),
    p_note: opt(fd, 'note'),
    p_photo_path: photo.path,
    p_override_short: isOpsStaff(profile.role) && str(fd, 'override_short') === 'yes',
  })
  if (error) return { error: cleanError(error.message) }
  revalidateOrder(job.order_id)
  return { success: true, message: 'Job done' }
}

/** Delivery: received counts, receiver, signature, seal / challan photo, POD. */
export async function completeDeliveryAction(fd: FormData): Promise<Result> {
  const deliveryId = str(fd, 'delivery_id')
  const jobId = opt(fd, 'job_id')
  if (!isUuid(deliveryId)) return { error: 'Delivery is required' }
  const profile = await getProfile()
  if (!profile || !profile.is_active) return { error: 'Not authenticated' }
  const supabase = await createClient()
  let orderId: string
  if (jobId) {
    const loaded = await loadActionableJob(jobId)
    if ('error' in loaded) return { error: loaded.error }
    if (loaded.job.delivery_id !== deliveryId) return { error: 'Job and delivery do not match' }
    orderId = loaded.job.order_id
  } else {
    if (!isOpsStaff(profile.role)) return { error: 'Only operations or admin can do this' }
    const { data } = await supabase.from('deliveries').select('order_id').eq('id', deliveryId).maybeSingle()
    if (!data) return { error: 'Delivery not found' }
    orderId = data.order_id
  }
  const folder = `delivery-${deliveryId}`
  const signature = await uploadProof(fd.get('signature'), orderId, folder, 'Signature')
  if (signature.error) return { error: signature.error }
  const seal = await uploadProof(fd.get('seal_photo'), orderId, folder, 'Seal photo')
  if (seal.error) return { error: seal.error }
  const pod = await uploadProof(fd.get('pod'), orderId, folder, 'POD')
  if (pod.error) return { error: pod.error }
  const before = await orderStatus(supabase, orderId)
  const { error } = await supabase.rpc('complete_delivery', {
    p_delivery_id: deliveryId,
    p_lines: countsFrom(fd).map(({ order_item_id, delivered, damaged }) => ({ order_item_id, delivered, damaged })),
    p_receiver_name: opt(fd, 'receiver_name'),
    p_receiver_phone: opt(fd, 'receiver_phone'),
    p_signature_path: signature.path,
    p_seal_photo_path: seal.path,
    p_pod_path: pod.path,
    p_note: opt(fd, 'note'),
  })
  if (error) return { error: cleanError(error.message) }
  const after = await orderStatus(supabase, orderId)
  if (after && before !== after && lifecycleEmailsOn()) {
    const { orderStageChangedCustomerEmail } = await import('@/lib/email/order-emails')
    await orderStageChangedCustomerEmail(orderId, after)
  }
  revalidateOrder(orderId)
  return { success: true, message: 'Delivery recorded' }
}

// ---------------------------------------------------------------------------
// Deliveries and line cancel.
// ---------------------------------------------------------------------------

export async function createDeliveryAction(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  const method = str(fd, 'method')
  const ids = fd.getAll('deliver_id').map(String).filter(isUuid)
  const lines = ids
    .map((id) => ({ order_item_id: id, qty: int(fd, `qty_${id}`) }))
    .filter((l) => l.qty === null || l.qty > 0)
  if (!lines.length) return { error: 'Choose at least one packed line' }
  return runRpc(
    'create_delivery',
    {
      p_order_id: orderId,
      p_lines: lines,
      p_method: method,
      p_courier_partner_id: method === 'courier' ? opt(fd, 'courier_partner_id') : null,
      p_tracking: method === 'courier' ? opt(fd, 'tracking_number') : null,
      p_runner_id: method === 'runner' ? opt(fd, 'runner_id') : null,
      p_address: opt(fd, 'address'),
      p_contact_phone: opt(fd, 'contact_phone'),
    },
    orderId,
    method === 'runner' ? 'Delivery job created' : 'Courier dispatch recorded',
  )
}

export async function cancelOrderLine(fd: FormData): Promise<Result> {
  const orderId = str(fd, 'order_id')
  const reason = str(fd, 'reason')
  if (!reason) return { error: 'Give a reason' }
  return runRpc('cancel_order_line', { p_item_id: str(fd, 'order_item_id'), p_reason: reason }, orderId, 'Line cancelled')
}

/** Admin-only: change a lifecycle default (the TODO(client) switches). */
export async function saveLifecycleSettings(fd: FormData): Promise<Result> {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') return { error: 'Only admin can change these settings' }
  const list = (key: string) =>
    str(fd, key)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  const settings = {
    early_branding_approval: str(fd, 'early_branding_approval') === 'yes',
    short_count_policy: str(fd, 'short_count_policy') === 'block' ? 'block' : 'continue',
    require_signature: str(fd, 'require_signature') === 'yes',
    require_seal_photo: str(fd, 'require_seal_photo') === 'yes',
    allow_partial_delivery: str(fd, 'allow_partial_delivery') === 'yes',
    branding_sources: list('branding_sources'),
    stock_sources: list('stock_sources'),
    payable_on: str(fd, 'payable_on') === 'manual' ? 'manual' : 'po_sent',
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('order_lifecycle_settings')
    .update({ settings, updated_at: new Date().toISOString(), updated_by: profile.id })
    .eq('id', true)
  if (error) return { error: cleanError(error.message) }
  revalidatePath('/crm/settings/order-lifecycle')
  return { success: true, message: 'Settings saved' }
}
