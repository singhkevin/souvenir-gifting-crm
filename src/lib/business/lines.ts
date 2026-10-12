export const BUSINESS_QUOTE_KEY = 'giffter_business_quote'
export const BUSINESS_QUOTE_META_KEY = 'giffter_business_quote_meta'
export const MAX_RFQ_LINES = 50
export const MAX_LINE_QTY = 100000
export const MAX_BREAKS = 3

export function minimumOrderQty(moq: number | null | undefined) {
  const value = Math.round(Number(moq) || 1)
  return value > 0 ? value : 1
}

export function businessQuantityError(quantity: number, moq: number | null | undefined) {
  const minimum = minimumOrderQty(moq)
  const qty = Math.round(Number(quantity))
  if (!Number.isInteger(qty) || qty < minimum || qty > MAX_LINE_QTY) {
    return `Quantity must be a whole number from ${minimum} to ${MAX_LINE_QTY.toLocaleString('en-IN')}`
  }
  return null
}

export function normaliseBreaks(moq: number | null | undefined, quantity: number, raw: number[]) {
  const minimum = minimumOrderQty(moq)
  const seen = new Set<number>()
  const breaks: number[] = []
  for (const value of raw) {
    const qty = Math.round(Number(value))
    if (!Number.isInteger(qty) || qty < minimum || qty > MAX_LINE_QTY || qty === quantity || seen.has(qty)) continue
    seen.add(qty)
    breaks.push(qty)
    if (breaks.length === MAX_BREAKS) break
  }
  return breaks
}

export function targetPriceError(value: number | null | undefined) {
  if (value == null) return null
  const price = Number(value)
  if (!Number.isFinite(price) || price < 0) return 'Target price must be zero or more'
  return null
}
