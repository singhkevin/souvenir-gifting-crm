import { pickBestOffer, type SupplierOffer } from '@/lib/pricing/offers'

/**
 * Where a product's cost comes from. Mirrors public.effective_product_cost.
 * - portal_default (product default): the portal rule's default_cost_source, one of the three below
 * - manual: product_costs.supplier_cost
 * - preferred: the pinned preferred supplier offer when it is eligible, else the manual cost
 * - lowest: the best eligible offer (a pinned preferred offer wins), else the manual cost
 * Eligible: active, in stock when required, and MOQ at or below the quantity.
 * Listed prices use the product MOQ as the quantity.
 *
 * Phase 1 treats every cost as INR excluding GST.
 * TODO phase 2: quantity tiers, supplier currency/FX, GST-inclusive supplier costs, stale offers.
 */
/** A concrete cost basis. Portal rules pick one of these as their default. */
export type ResolvedCostSource = 'manual' | 'preferred' | 'lowest'

/** A product's choice. portal_default follows each portal's default; anything else applies on every portal. */
export type CostSource = 'portal_default' | ResolvedCostSource

export const COST_SOURCES: CostSource[] = ['portal_default', 'manual', 'preferred', 'lowest']
export const RESOLVED_COST_SOURCES: ResolvedCostSource[] = ['manual', 'preferred', 'lowest']

export const COST_SOURCE_LABEL: Record<CostSource, string> = {
  portal_default: 'Use portal default',
  manual: 'Manual cost',
  preferred: 'Preferred supplier',
  lowest: 'Lowest eligible offer',
}

/** A stored product value. Missing (before the migration) means portal_default, which resolves to manual on day one. */
export function asCostSource(value: unknown): CostSource {
  return typeof value === 'string' && (COST_SOURCES as string[]).includes(value) ? (value as CostSource) : 'portal_default'
}

/** A stored portal default. Missing or unknown means manual. */
export function asResolvedCostSource(value: unknown): ResolvedCostSource {
  return typeof value === 'string' && (RESOLVED_COST_SOURCES as string[]).includes(value) ? (value as ResolvedCostSource) : 'manual'
}

const ALIASES: Record<string, CostSource> = {
  portal_default: 'portal_default',
  'portal default': 'portal_default',
  default: 'portal_default',
  'use portal default': 'portal_default',
  manual: 'manual',
  preferred: 'preferred',
  preferred_supplier: 'preferred',
  'preferred supplier': 'preferred',
  lowest: 'lowest',
  lowest_offer: 'lowest',
  best: 'lowest',
  'lowest offer': 'lowest',
  'lowest eligible offer': 'lowest',
}

/** Parse a product form or CSV value. Blank = portal_default; anything else unknown is an error. */
export function parseCostSource(raw: unknown): { ok: true; value: CostSource } | { ok: false; error: string } {
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) return { ok: true, value: 'portal_default' }
  const value = ALIASES[text]
  return value ? { ok: true, value } : { ok: false, error: 'Cost source must be portal_default, manual, preferred or lowest' }
}

/** Parse a portal rule's default. Blank = manual; portal_default is not allowed here. */
export function parsePortalCostSource(raw: unknown): { ok: true; value: ResolvedCostSource } | { ok: false; error: string } {
  const text = String(raw ?? '').trim().toLowerCase()
  if (!text) return { ok: true, value: 'manual' }
  const value = ALIASES[text]
  return value && value !== 'portal_default'
    ? { ok: true, value }
    : { ok: false, error: 'A portal cost source must be manual, preferred or lowest' }
}

/** The basis a product uses on one portal. Mirrors the first step of public.effective_product_cost. */
export function resolveCostSource(source: CostSource | null | undefined, portalDefault: ResolvedCostSource | null | undefined): ResolvedCostSource {
  if (!source || source === 'portal_default') return portalDefault || 'manual'
  return source
}

export type EffectiveCostInput = {
  source: CostSource | null | undefined
  /** The portal rule's default, used when source is portal_default. Null/omitted = manual (no portal). */
  portalDefault?: ResolvedCostSource | null
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
  /** The basis actually used after the portal default. */
  basis: ResolvedCostSource
}

function finite(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function effectiveCost(input: EffectiveCostInput): EffectiveCost {
  const manual = finite(input.manualCost)
  const source = resolveCostSource(input.source, input.portalDefault)
  const manualResult: EffectiveCost = manual == null
    ? { cost: null, from: 'none', offerId: null, basis: source }
    : { cost: manual, from: 'manual', offerId: null, basis: source }
  if (source === 'manual') return manualResult

  const quantity = Math.max(1, Math.round(finite(input.quantity) ?? finite(input.productMoq) ?? 1))
  if (source === 'preferred') {
    const preferred = input.offers.find((offer) =>
      offer.is_preferred
      && offer.is_active
      && Number.isFinite(offer.cost)
      && (!input.requireInStock || offer.in_stock)
      && offer.moq <= quantity)
    return preferred ? { cost: preferred.cost, from: 'offer', offerId: preferred.id, basis: source } : manualResult
  }

  const best = pickBestOffer(input.offers, { quantity, requireInStock: input.requireInStock })
  return best ? { cost: best.cost, from: 'offer', offerId: best.id, basis: source } : manualResult
}
