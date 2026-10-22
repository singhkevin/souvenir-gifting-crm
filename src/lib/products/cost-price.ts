/**
 * Products are entered with one number: the cost (supplier) price.
 * Every selling price is calculated from the effective cost (see lib/pricing/cost-basis.ts)
 * plus fixed prices and margins set in CRM → Pricing. There is no retail override.
 *
 * products.price is frozen legacy data for one release (20261022_pricing_cost_basis.sql):
 * nothing reads it for pricing, and after the migration a trigger keeps it unchanged on
 * update and stores 0 on insert. Until that migration is applied the column is NOT NULL
 * without a default, so inserts still send `legacyPriceForInsert(cost)`.
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

/** Cost price is required on the product form and must be above zero. */
export function resolveCost(raw: unknown): { ok: true; cost: number } | { ok: false; error: string } {
  const cost = parseAmount(raw)
  if (!cost.ok) return { ok: false, error: 'Cost price must be a number 0 or greater' }
  if (cost.value == null || cost.value <= 0) return { ok: false, error: 'Cost price is required' }
  return { ok: true, cost: cost.value }
}

/** Value for the frozen products.price column on insert (NOT NULL before the migration). */
export function legacyPriceForInsert(cost: number | null | undefined): number {
  return cost != null && Number.isFinite(cost) && cost >= 0 ? cost : 0
}

/**
 * Product CSV rows. The cost column wins; an old file's price column is read as the cost
 * when the cost column is blank (old files had price = cost). Accounts that cannot set costs
 * import without a cost, so those products are priced on quote until a cost is added.
 */
export function resolveCsvCost(input: {
  cost: number | null
  priceRaw: string
  allowCosts: boolean
}): { ok: true; cost: number | null } | { ok: false; reason: string } {
  if (!input.allowCosts) return { ok: true, cost: null }
  if (input.cost != null) {
    if (input.cost < 0) return { ok: false, reason: 'Cost price must be a number 0 or greater' }
    return { ok: true, cost: input.cost }
  }
  const price = parseAmount(input.priceRaw)
  if (!price.ok) return { ok: false, reason: 'Price must be a number 0 or greater' }
  if (price.value != null) return { ok: true, cost: price.value }
  return { ok: false, reason: 'Cost price is required' }
}
