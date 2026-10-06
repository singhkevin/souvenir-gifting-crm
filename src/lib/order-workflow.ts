export const ORDER_LIFECYCLE = [
  "created",
  "procurement",
  "mockup",
  "client_approval",
  "production",
  "packaging_qc",
  "dispatched",
  "delivered",
] as const

export type LifecycleStatus = (typeof ORDER_LIFECYCLE)[number] | "cancelled"

/**
 * How rows written before the fulfillment-stage migration are stored afterwards.
 * Historical tokens are also copied onto the history note by the migration.
 * `in_progress` stays with procurement: the previous sequence placed it before
 * procurement, and the control-center board already grouped those cards there.
 * `printing` becomes production so in-flight branding is not sent back through
 * the new client-approval gate.
 */
export const LEGACY_ORDER_STATUS_MAP: Record<string, string> = {
  created: "created",
  confirmed: "created",
  in_progress: "procurement",
  procurement: "procurement",
  printing: "production",
  quality_check: "packaging_qc",
  ready_to_dispatch: "packaging_qc",
  dispatched: "dispatched",
  delivered: "delivered",
  cancelled: "cancelled",
}

const KNOWN_STATUSES = new Set<string>([...ORDER_LIFECYCLE, "cancelled"])

export const ORDER_STATUS_LABELS: Record<string, string> = {
  created: "Order received",
  procurement: "Procurement",
  mockup: "Mockup",
  client_approval: "Client approval",
  production: "Production",
  packaging_qc: "Packaging / QC",
  dispatched: "Dispatch",
  delivered: "Delivered",
  cancelled: "Cancelled",
  confirmed: "Planning",
  in_progress: "In Progress",
  printing: "Printing",
  quality_check: "Quality Check",
  ready_to_dispatch: "Packing",
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  created: "Order received",
  procurement: "Procurement",
  mockup: "Mockup",
  client_approval: "Client approval",
  production: "Production",
  packaging_qc: "Packaging / QC",
  dispatched: "Dispatch",
  delivered: "Delivered",
  cancelled: "Cancelled",
  confirmed: "Order Confirmed",
  in_progress: "In Production",
  printing: "Printing in Progress",
  quality_check: "Quality Check",
  ready_to_dispatch: "Ready to Dispatch",
}

export const STAGE_DEPARTMENT: Record<string, string> = {
  created: "sales",
  procurement: "procurement",
  mockup: "printing",
  client_approval: "sales",
  production: "printing",
  packaging_qc: "quality",
  dispatched: "logistics",
  delivered: "accounts",
}

export type OrderHealth = "on_track" | "at_risk" | "delayed"

export function orderHealth(
  status: string | null | undefined,
  expectedDelivery: string | null | undefined,
  stageDue: string | null | undefined,
  today = new Date()
): OrderHealth {
  if (!status || status === "delivered" || status === "cancelled") return "on_track"
  const day = today.toISOString().slice(0, 10)
  if (expectedDelivery && expectedDelivery < day) return "delayed"
  const inThree = new Date(today)
  inThree.setDate(inThree.getDate() + 3)
  const soon = inThree.toISOString().slice(0, 10)
  if (stageDue && stageDue < day) return "at_risk"
  if (expectedDelivery && expectedDelivery <= soon) return "at_risk"
  return "on_track"
}

export const HEALTH_LABELS: Record<OrderHealth, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  delayed: "Delayed",
}

export const HEALTH_STYLES: Record<OrderHealth, string> = {
  on_track: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  at_risk: "bg-amber-50 text-amber-800 border border-amber-200",
  delayed: "bg-red-50 text-red-800 border border-red-200",
}

export function nextLifecycleStatus(current: string): string | null {
  const i = ORDER_LIFECYCLE.indexOf(current as (typeof ORDER_LIFECYCLE)[number])
  if (i < 0) return null
  return ORDER_LIFECYCLE[i + 1] ?? null
}

export function lifecycleIndex(status: string): number {
  const i = ORDER_LIFECYCLE.indexOf(status as (typeof ORDER_LIFECYCLE)[number])
  return i < 0 ? 0 : i
}

export function canAdvanceTo(
  from: string,
  to: string,
  approval?: string | null
): { ok: true } | { ok: false; reason: string } {
  if (!KNOWN_STATUSES.has(to)) return { ok: false, reason: "Invalid stage" }
  if (from === to) return { ok: true }
  if (from === "delivered" || from === "cancelled") {
    return { ok: false, reason: "This stage is terminal" }
  }
  if (to === "cancelled") return { ok: true }
  if (from === "client_approval" && to === "mockup") return { ok: true }

  const next = nextLifecycleStatus(from)
  if (to !== next) {
    return {
      ok: false,
      reason: next
        ? `Move one stage at a time. Next stage is ${ORDER_STATUS_LABELS[next]}.`
        : "This stage is terminal",
    }
  }
  if (from === "client_approval" && to === "production" && approval !== "approved") {
    return { ok: false, reason: "Client approval is required before production" }
  }
  return { ok: true }
}

export function handoffStageOptions(status: string, approval?: string | null) {
  const options: { value: string; label: string }[] = [
    { value: status, label: `${ORDER_STATUS_LABELS[status] || status} (keep)` },
  ]
  const next = nextLifecycleStatus(status)
  if (next && canAdvanceTo(status, next, approval).ok) {
    options.push({ value: next, label: ORDER_STATUS_LABELS[next] || next })
  }
  if (status === "client_approval") {
    options.push({ value: "mockup", label: "Mockup (request changes)" })
  }
  if (status !== "cancelled" && status !== "delivered") {
    options.push({ value: "cancelled", label: "Cancelled" })
  }
  return options
}
