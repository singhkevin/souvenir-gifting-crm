/**
 * Products are entered with one number: the cost (supplier) price.
 * The stored retail price is the base the pricing engine works from. It equals
 * the cost (0% margin) unless someone sets an explicit retail override.
 * Portal margins, fixed prices and company prices are set in CRM → Pricing.
 */

export type ParsedAmount = { ok: true; value: number | null } | { ok: false }

/** Blank is null. Anything else must be a finite number of 0 or more. */
export function parseAmount(raw: unknown): ParsedAmount {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return { ok: true, value: null }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return { ok: false }
  return { ok: true, value: Math.round(value * 100) / 100 }
}

/** Retail base price: the override when one is given, otherwise the cost. */
export function retailFromCost(cost: number, override: number | null | undefined): number {
  return override != null ? override : cost
}

/**
 * Cost price is required and must be above zero. An optional retail override
 * replaces the cost as the stored retail price.
 */
export function resolveCostAndRetail(input: {
  cost: unknown
  retailOverride?: unknown
}): { ok: true; cost: number; price: number } | { ok: false; error: string } {
  const cost = parseAmount(input.cost)
  if (!cost.ok) return { ok: false, error: 'Cost price must be a number 0 or greater' }
  if (cost.value == null || cost.value <= 0) return { ok: false, error: 'Cost price is required' }
  const override = parseAmount(input.retailOverride)
  if (!override.ok) return { ok: false, error: 'Retail price override must be a number 0 or greater' }
  return { ok: true, cost: cost.value, price: retailFromCost(cost.value, override.value) }
}

/**
 * CSV rows: a price column is optional. When price is blank and a cost is
 * given, retail = cost. A row needs at least one of the two.
 */
export function resolveCsvRetail(input: {
  priceRaw: string
  cost: number | null
}): { ok: true; price: number } | { ok: false; reason: string } {
  const price = parseAmount(input.priceRaw)
  if (!price.ok) return { ok: false, reason: 'Price must be a number 0 or greater' }
  if (price.value != null) return { ok: true, price: price.value }
  if (input.cost != null && input.cost >= 0) return { ok: true, price: input.cost }
  return { ok: false, reason: 'Cost price is required (or a price)' }
}
