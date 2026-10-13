/** Client-safe rules for the portal catalog quote basket. */

export const QUOTE_QTY_MAX = 100000

export function normalizeMoq(moq: number | null | undefined) {
  const n = Math.round(Number(moq))
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, QUOTE_QTY_MAX)
}

/** Whole-number quantity, never below the offering MOQ and never above the RFQ cap. */
export function clampQuoteQty(value: number, moq: number) {
  const floor = normalizeMoq(moq)
  if (!Number.isFinite(value)) return floor
  const qty = Math.round(value)
  if (qty < floor) return floor
  if (qty > QUOTE_QTY_MAX) return QUOTE_QTY_MAX
  return qty
}

export type BudgetBadge = 'within' | 'over'

/**
 * When a catalog has a per-person budget, every priced comparison is one of two badges.
 * A missing price cannot be shown as within budget.
 */
export function budgetBadge(
  price: number | null | undefined,
  budget: number | null | undefined,
): BudgetBadge | null {
  if (budget == null || !Number.isFinite(Number(budget)) || Number(budget) <= 0) return null
  if (price == null || !Number.isFinite(Number(price))) return 'over'
  return Number(price) <= Number(budget) ? 'within' : 'over'
}

export function quoteEstimate(lines: { price: number | null; quantity: number }[]) {
  let total = 0
  let unpriced = 0
  for (const line of lines) {
    if (line.price == null || !Number.isFinite(line.price)) unpriced += 1
    else total += line.price * line.quantity
  }
  return { total, unpriced }
}
