/** Pure sample-ledger rules. Server actions call these before they write stock. */

export function parseSampleQty(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  const text = String(raw ?? '').trim()
  if (!text) return { ok: true, value: null }
  const qty = Number(text)
  if (!Number.isInteger(qty) || qty < 0 || qty > 1000000) {
    return { ok: false, error: 'Sample quantity must be a whole number from 0 to 1000000' }
  }
  return { ok: true, value: qty }
}

/**
 * Pieces to put in office the first time a product enters Samples.
 * sample_only with a blank quantity uses stock on hand (including zero, so the row still appears).
 * A positive sample quantity seeds stock even when the product is also sellable.
 */
export function initialOfficeQuantity(input: {
  sampleOnly: boolean
  sampleQty: number | null
  stockQty: number
}): number | null {
  if (input.sampleOnly) return input.sampleQty ?? Math.max(0, input.stockQty)
  if (input.sampleQty != null && input.sampleQty > 0) return input.sampleQty
  return null
}

export function planReceiveIntoOffice(input: {
  quantity: number
  heldByClient: number
  inOffice: number
  withClient: number
}):
  | { ok: false; error: string }
  | { ok: true; inOffice: number; withClient: number; heldByClient: number } {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return { ok: false, error: 'Enter a positive whole quantity.' }
  }
  if (!Number.isInteger(input.heldByClient) || input.heldByClient < 1) {
    return { ok: false, error: 'That client is not holding this sample.' }
  }
  if (input.quantity > input.heldByClient) {
    return { ok: false, error: `That client holds ${input.heldByClient}.` }
  }
  if (!Number.isInteger(input.withClient) || input.quantity > input.withClient) {
    return { ok: false, error: `Only ${Math.max(0, input.withClient || 0)} are with clients.` }
  }
  return {
    ok: true,
    inOffice: input.inOffice + input.quantity,
    withClient: input.withClient - input.quantity,
    heldByClient: input.heldByClient - input.quantity,
  }
}

export function matchesSampleSearch(query: string, fields: Array<string | null | undefined>) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return fields.some((field) => (field || '').toLowerCase().includes(needle))
}
