export type CostingDraftFields = {
  offerId: string
  cost: string
  margin: string
  unit: string
}

function parsedAmount(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

function amountsEqual(left: string, right: string) {
  const a = parsedAmount(left)
  const b = parsedAmount(right)
  if (a == null && b == null) return true
  if (a == null || b == null) return false
  return Math.abs(a - b) < 0.001
}

/** True when the line's inputs differ from the last successful save. */
export function costingFieldsDirty(current: CostingDraftFields, saved: CostingDraftFields) {
  return current.offerId !== saved.offerId
    || !amountsEqual(current.cost, saved.cost)
    || !amountsEqual(current.margin, saved.margin)
    || !amountsEqual(current.unit, saved.unit)
}

export function costingStatusLabel(saving: boolean, dirty: boolean) {
  if (saving) return 'Saving…'
  if (dirty) return 'Unsaved changes'
  return 'Saved'
}
