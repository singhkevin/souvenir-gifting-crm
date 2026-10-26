/**
 * Order lifecycle v2: each product line moves through its own stages and the order's
 * status is the slowest line (computed in the database by recompute_order_status).
 * Schema: supabase/migrations/20261023_order_line_lifecycle.sql.
 *
 * Until that migration is applied the app keeps the old order-level flow; see
 * `lineLifecycleEnabled` in ./line-lifecycle-server.ts.
 */

export const LINE_STAGES = [
  'confirmed',
  'sourcing',
  'supplier_pickup',
  'to_printer',
  'at_printer',
  'printing',
  'printer_pickup',
  'packing',
  'out_for_delivery',
  'delivered',
] as const

export type LineStage = (typeof LINE_STAGES)[number] | 'cancelled'

export const LINE_STAGE_LABELS: Record<string, string> = {
  confirmed: 'To plan',
  sourcing: 'Sourcing',
  supplier_pickup: 'Pickup at supplier',
  to_printer: 'Going to printer',
  at_printer: 'At printer',
  printing: 'Printing',
  printer_pickup: 'Pickup at printer',
  packing: 'Packing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

/** What a client or guest sees for a line. Never mentions suppliers or printers by name. */
export const CLIENT_LINE_STAGE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  sourcing: 'Being sourced',
  supplier_pickup: 'Being sourced',
  to_printer: 'Branding',
  at_printer: 'Branding',
  printing: 'Branding',
  printer_pickup: 'Branding',
  packing: 'Packing',
  out_for_delivery: 'On its way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const LINE_STAGE_STYLES: Record<string, string> = {
  confirmed: 'bg-[#F6F3EC] text-[#4A4640] border-[#CCC5BD]',
  sourcing: 'bg-[#FFB690]/20 text-[#9E4300] border-[#9E4300]/30',
  supplier_pickup: 'bg-[#FFB690]/20 text-[#9E4300] border-[#9E4300]/30',
  to_printer: 'bg-[#E8E2F5] text-[#4B3B7A] border-[#4B3B7A]/30',
  at_printer: 'bg-[#E8E2F5] text-[#4B3B7A] border-[#4B3B7A]/30',
  printing: 'bg-[#E8E2F5] text-[#4B3B7A] border-[#4B3B7A]/30',
  printer_pickup: 'bg-[#E8E2F5] text-[#4B3B7A] border-[#4B3B7A]/30',
  packing: 'bg-[#E3EEF6] text-[#24506E] border-[#24506E]/30',
  out_for_delivery: 'bg-[#E3EEF6] text-[#24506E] border-[#24506E]/30',
  delivered: 'bg-[#DAE6D3] text-[#3A4537] border-[#3A4537]/20',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-300',
}

export function lineStageIndex(stage: string | null | undefined) {
  const i = LINE_STAGES.indexOf((stage || '') as (typeof LINE_STAGES)[number])
  return i < 0 ? 0 : i
}

export const RUNNER_JOB_KIND_LABELS: Record<string, string> = {
  supplier_pickup: 'Pick up from supplier',
  to_printer: 'Take to printer',
  printer_pickup: 'Pick up from printer',
  delivery: 'Deliver to client',
}

export const RUNNER_JOB_STATUS_LABELS: Record<string, string> = {
  open: 'Not assigned',
  assigned: 'Assigned',
  in_progress: 'On the way',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent to supplier',
  ready: 'Ready for pickup',
  collected: 'Collected',
  cancelled: 'Cancelled',
}

export const PRINT_JOB_STATUS_LABELS: Record<string, string> = {
  pending: 'Waiting for go-ahead',
  go_ahead: 'Printing',
  ready: 'Ready for pickup',
  collected: 'Collected',
  cancelled: 'Cancelled',
}

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  out: 'Out for delivery',
  delivered: 'Delivered',
  partly_delivered: 'Part delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

/**
 * App-side copy of the defaults seeded into public.order_lifecycle_settings. The database row
 * is the source of truth once the migration is applied (admins can change it); these are only
 * used to describe the defaults and when the row cannot be read.
 */
export type LifecycleSettings = {
  /** TODO(client): may the client approve branding before goods reach the printer? */
  early_branding_approval: boolean
  /** TODO(client): on a short count, 'continue' (flag it) or 'block' (ops must confirm). */
  short_count_policy: 'continue' | 'block'
  /** TODO(client): receiver signature required for runner deliveries? */
  require_signature: boolean
  /** TODO(client): seal or stamped challan photo required for runner deliveries? */
  require_seal_photo: boolean
  /** TODO(client): may orders be delivered in parts? */
  allow_partial_delivery: boolean
  /** TODO(client): order sources whose lines need branding by default. */
  branding_sources: string[]
  /** TODO(client): order sources whose lines ship from stock by default. */
  stock_sources: string[]
  /** TODO(client): raise the supplier payable when the PO is sent ('po_sent') or never ('manual'). */
  payable_on: 'po_sent' | 'manual'
}

export const DEFAULT_LIFECYCLE_SETTINGS: LifecycleSettings = {
  early_branding_approval: true,
  short_count_policy: 'continue',
  require_signature: true,
  require_seal_photo: false,
  allow_partial_delivery: true,
  branding_sources: ['portal', 'microsite', 'crm'],
  stock_sources: ['store'],
  payable_on: 'po_sent',
}

export function mergeLifecycleSettings(raw: unknown): LifecycleSettings {
  const value = raw && typeof raw === 'object' ? (raw as Partial<LifecycleSettings>) : {}
  return { ...DEFAULT_LIFECYCLE_SETTINGS, ...value }
}

/** Client-facing step for the whole order, used by the guest page and portal. */
export const CLIENT_ORDER_STEPS = [
  { id: 'placed', label: 'Order placed', desc: 'Order received and confirmed' },
  { id: 'preparing', label: 'Being prepared', desc: 'Sourcing and branding' },
  { id: 'packed', label: 'Packed', desc: 'Packed and checked' },
  { id: 'on_the_way', label: 'On its way', desc: 'Dispatched to you' },
  { id: 'delivered', label: 'Delivered', desc: 'Received' },
] as const

export function clientOrderStepIndex(status: string | null | undefined): number {
  switch (status) {
    case 'created':
    case 'confirmed':
      return 0
    case 'procurement':
    case 'mockup':
    case 'client_approval':
    case 'production':
    case 'in_progress':
    case 'printing':
      return 1
    case 'packaging_qc':
    case 'quality_check':
    case 'ready_to_dispatch':
      return 2
    case 'dispatched':
    case 'partly_delivered':
      return 3
    case 'delivered':
      return 4
    default:
      return 0
  }
}

/** Branded lines that still have to clear the approval gate. */
export function linesAwaitingBranding(lines: { needs_branding?: boolean | null; stage?: string | null }[]) {
  return lines.filter(
    (l) => l.needs_branding && ['confirmed', 'sourcing', 'supplier_pickup', 'to_printer', 'at_printer'].includes(String(l.stage)),
  )
}

/** Short-lived signed link for a proof file in the private order-proofs bucket. */
export const ORDER_PROOFS_BUCKET = 'order-proofs'
