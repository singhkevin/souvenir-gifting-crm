import { pickBestOffer, type SupplierOffer } from '@/lib/pricing/offers'

/**
 * Where a product's cost comes from. Mirrors public.effective_product_cost.
 * - manual: product_costs.supplier_cost
 * - preferred: the pinned preferred supplier offer when it is eligible, else the manual cost
 * - lowest: the best eligible offer (a pinned preferred offer wins), else the manual cost
 * Eligible: active, in stock when required, and MOQ at or below the quantity.
 * Listed prices use the product MOQ as the quantity.
 *
 * Phase 1 treats every cost as INR excluding GST.
 * TODO phase 2: quantity tiers, supplier currency/FX, GST-inclusive supplier costs, stale offers.
 */
export type CostSource = 'manual' | 'preferred' | 'lowest'

export const COST_SOURCES: CostSource[] = ['manual', 'preferred', 'lowest']

export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  manual: 'Manual cost',
  preferred: 'Preferred supplier',
  lowest: 'Lowest eligible offer',
}

export function asCostSource(value: unknown): CostSource {
  return typeof value === 'string' && (COST_SOURCES as string[]).includes(value) ? (value as CostSource) : 'manual'
}

/** Parse a form or CSV value. Blank keeps manual; anything else unknown is an error. */
export function parseCostSource(raw: unknown): { ok: true; value: CostSource } | { ok: false; error: string } {
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) return { ok: true, value: 'manual' }
  const aliases: Record<string, CostSource> = {
    manual: 'manual',
    preferred: 'preferred',
    'preferred supplier': 'preferred',
    lowest: 'lowest',
    best: 'lowest',
    'lowest eligible offer': 'lowest',
  }
  const value = aliases[text]
  return value ? { ok: true, value } : { ok: false, error: 'Cost source must be manual, preferred or lowest' }
}

export type EffectiveCostInput = {
  source: CostSource | null | undefined
  manualCost: number | null | undefined
  offers: SupplierOffer[]
  /** Ordered quantity. Null uses the product MOQ. */
  quantity?: number | null
  productMoq?: number | null
  requireInStock: boolean
}

export type EffectiveCost = {
  cost: number | null
  /** What the cost came from: manual, or the offer that was used. */
  from: 'manual' | 'offer' | 'none'
  offerId: string | null
}

function finite(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function effectiveCost(input: EffectiveCostInput): EffectiveCost {
  const manual = finite(input.manualCost)
  const manualResult: EffectiveCost = manual == null
    ? { cost: null, from: 'none', offerId: null }
    : { cost: manual, from: 'manual', offerId: null }
  const source = input.source || 'manual'
  if (source === 'manual') return manualResult

  const quantity = Math.max(1, Math.round(finite(input.quantity) ?? finite(input.productMoq) ?? 1))
  if (source === 'preferred') {
    const preferred = input.offers.find((offer) =>
      offer.is_preferred
      && offer.is_active
      && Number.isFinite(offer.cost)
      && (!input.requireInStock || offer.in_stock)
      && offer.moq <= quantity)
    return preferred ? { cost: preferred.cost, from: 'offer', offerId: preferred.id } : manualResult
  }

  const best = pickBestOffer(input.offers, { quantity, requireInStock: input.requireInStock })
  return best ? { cost: best.cost, from: 'offer', offerId: best.id } : manualResult
}
