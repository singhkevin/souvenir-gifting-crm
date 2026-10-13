export type ImportNotice = { row: number; sku: string; reason: string }

export const PRODUCT_STATUSES = ['active', 'inactive', 'discontinued'] as const

export const COST_CSV_FIELDS = ['supplier_cost', 'internal_margin', 'internal_notes'] as const

const COST_IGNORED_REASON =
  'Cost columns were ignored. This account cannot import supplier cost, product margin, or internal notes.'

/** Blank status stays active. Any other unknown value is rejected. */
export function parseProductStatus(raw: string): { ok: true; status: string } | { ok: false; reason: string } {
  const value = raw.trim().toLowerCase()
  if (!value) return { ok: true, status: 'active' }
  if ((PRODUCT_STATUSES as readonly string[]).includes(value)) return { ok: true, status: value }
  return { ok: false, reason: 'Status must be active, inactive, or discontinued' }
}

export function parseOptionalNumber(raw: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: null }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { ok: false }
  return { ok: true, value }
}

/** One summary warning when a user without cost access supplied cost cells. */
export function ignoredCostWarning(rows: Record<string, string>[]): ImportNotice | null {
  const present = rows.some((row) => COST_CSV_FIELDS.some((field) => (row[field] || '').trim() !== ''))
  if (!present) return null
  return { row: 0, sku: '', reason: COST_IGNORED_REASON }
}

/** Image and variant problems keep the product row and show up in the summary. */
export function sideEffectWarning(
  row: number,
  sku: string,
  kind: 'image' | 'variant',
  errorMessage: string | null | undefined,
): ImportNotice | null {
  const message = (errorMessage || '').trim()
  if (!message) return null
  const lead = kind === 'image' ? 'Image was not saved' : 'Variant was not saved'
  return { row, sku, reason: `${lead}: ${message}` }
}
