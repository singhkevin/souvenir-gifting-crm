export const PAYMENT_FILTERS = ['unpaid', 'partially_paid', 'paid', 'overdue', 'none'] as const

export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

export const PAYMENT_FILTER_LABELS: Record<PaymentFilter, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  none: 'No invoice',
}

export function isPaymentFilter(value: string | null | undefined): value is PaymentFilter {
  return PAYMENT_FILTERS.includes(value as PaymentFilter)
}

/** Newest invoice wins. Draft and issued are unpaid. A missing or cancelled invoice is "No invoice". */
export function paymentLabel(status: string | null | undefined): string {
  if (!status || status === 'cancelled') return 'No invoice'
  if (status === 'paid') return 'Paid'
  if (status === 'partially_paid') return 'Partially paid'
  if (status === 'overdue') return 'Overdue'
  if (status === 'draft' || status === 'issued' || status === 'unpaid') return 'Unpaid'
  return 'No invoice'
}

export function paymentFilterKey(status: string | null | undefined): PaymentFilter {
  const label = paymentLabel(status)
  if (label === 'Paid') return 'paid'
  if (label === 'Partially paid') return 'partially_paid'
  if (label === 'Overdue') return 'overdue'
  if (label === 'Unpaid') return 'unpaid'
  return 'none'
}

export function newestInvoiceStatus(
  invoices:
    | { status?: string | null; created_at?: string | null }
    | { status?: string | null; created_at?: string | null }[]
    | null
    | undefined,
): string | null {
  const rows = !invoices ? [] : Array.isArray(invoices) ? invoices : [invoices]
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return sorted[0]?.status || null
}
