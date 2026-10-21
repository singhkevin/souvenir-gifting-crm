import { specialPriceActive } from '@/lib/pricing/listed'
import { roundMoney } from '@/lib/pricing/resolve'

/** Store, the business portal, and the corporate portal (company portal, microsite, catalogs). */
export type PricingPortal = 'store' | 'business' | 'corporate'

export type PriceBase = 'retail' | 'cost'
export type RoundingMode = 'none' | 'whole' | 'end9' | 'end99'
export type GstMode = 'inclusive' | 'exclusive'
export type NoCostFallback = 'retail_margin' | 'on_quote'
export type PriceSource = 'override' | 'special' | 'catalog' | 'fixed' | 'rule' | 'on_quote'

export type PortalRule = {
  marginPercent: number | null
  /** Retail, or cost. On the store, retail means products.price as-is. Cost means auto from cost. */
  base: PriceBase
  noCostFallback: NoCostFallback
  rounding: RoundingMode
  gstMode: GstMode
  showPrices: boolean
  /** Warn in admin. Block saving a fixed price below cost plus this percent. Does not rewrite a price. */
  minMarginPercent: number
}

/**
 * Day-one rules. They reproduce today's prices:
 * store is the retail price, business and corporate are retail plus the company margin
 * (no portal margin), rounding is to paise, and nothing is hidden.
 */
export const SEEDED_PORTAL_RULES: Record<PricingPortal, PortalRule> = {
  store: {
    marginPercent: null,
    base: 'retail',
    noCostFallback: 'retail_margin',
    rounding: 'none',
    gstMode: 'inclusive',
    showPrices: true,
    minMarginPercent: 0,
  },
  business: {
    marginPercent: null,
    base: 'retail',
    noCostFallback: 'retail_margin',
    rounding: 'none',
    gstMode: 'exclusive',
    showPrices: true,
    minMarginPercent: 0,
  },
  corporate: {
    marginPercent: null,
    base: 'retail',
    noCostFallback: 'retail_margin',
    rounding: 'none',
    gstMode: 'exclusive',
    showPrices: true,
    minMarginPercent: 0,
  },
}

export const PORTAL_LABEL: Record<PricingPortal, string> = {
  store: 'Store',
  business: 'Business',
  corporate: 'Corporate',
}

export const SOURCE_LABEL: Record<PriceSource, string> = {
  override: 'Quote',
  special: 'Special',
  catalog: 'Catalog',
  fixed: 'Fixed',
  rule: 'Rule',
  on_quote: 'On quote',
}

export type PortalPriceInput = {
  portal: PricingPortal
  rule: PortalRule
  retailPrice?: number | null
  costPrice?: number | null
  companyMarginPercent?: number | null
  specialPrice?: number | null
  specialValidUntil?: string | null
  catalogManualPrice?: number | null
  portalFixedPrice?: number | null
  portalFixedValidUntil?: string | null
  quoteOverride?: number | null
  today?: Date
}

export type ResolvedPortalPrice = {
  price: number | null
  source: PriceSource
  /** Company margin when set, otherwise the portal margin. Null on the store while it stays on retail. */
  marginPercent: number | null
  /** (price − cost) / cost × 100. Null when cost is missing or zero. */
  marginOverCost: number | null
  belowFloor: boolean
  gstMode: GstMode
  rounding: RoundingMode
}

function asFinite(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Half away from zero, matching Postgres round(numeric). */
function roundHalfAway(value: number): number {
  const sign = value < 0 ? -1 : 1
  return sign * Math.round(Math.abs(value))
}

/** Same rounding as public.pricing_round_money. `none` is paise, which is what prices use today. */
export function applyPriceRounding(amount: number, mode: RoundingMode): number {
  if (!Number.isFinite(amount)) return 0
  if (mode === 'whole') return roundHalfAway(amount)
  if (mode === 'end9') {
    if (amount <= 0) return 0
    const next = roundHalfAway((amount - 9) / 10) * 10 + 9
    return next > 0 ? next : 9
  }
  if (mode === 'end99') {
    if (amount <= 0) return 0
    const next = roundHalfAway((amount - 99) / 100) * 100 + 99
    return next > 0 ? next : 99
  }
  return roundMoney(amount)
}

export function gstPriceNote(mode: GstMode): string {
  return mode === 'inclusive' ? 'incl. GST' : 'excl. GST'
}

export function marginOverCost(price: number | null, cost: number | null): number | null {
  if (price == null || cost == null || !(cost > 0)) return null
  return roundMoney(((price - cost) / cost) * 100)
}

export function floorPrice(cost: number | null, minMarginPercent: number | null): number | null {
  if (cost == null || !Number.isFinite(cost)) return null
  const floor = asFinite(minMarginPercent) ?? 0
  return roundMoney(cost * (1 + floor / 100))
}

/** True when a sell price sits under cost plus the portal's minimum margin. Missing cost never trips it. */
export function priceBelowFloor(
  price: number | null,
  cost: number | null,
  minMarginPercent: number | null,
): boolean {
  if (price == null) return false
  const floor = floorPrice(cost, minMarginPercent)
  if (floor == null) return false
  return roundMoney(price) + 0.001 < floor
}

export function fixedPriceBlockReason(
  price: number,
  cost: number | null,
  minMarginPercent: number | null,
): string | null {
  if (!priceBelowFloor(price, cost, minMarginPercent)) return null
  const floor = floorPrice(cost, minMarginPercent)
  const pct = asFinite(minMarginPercent) ?? 0
  return `That price is below cost plus the ${pct}% minimum margin (floor ${floor}).`
}

function finish(
  price: number | null,
  source: PriceSource,
  input: PortalPriceInput,
  marginPercent: number | null,
): ResolvedPortalPrice {
  const cost = asFinite(input.costPrice)
  const rounded = price == null ? null : applyPriceRounding(price, input.rule.rounding)
  return {
    price: rounded,
    source,
    marginPercent,
    marginOverCost: marginOverCost(rounded, cost),
    belowFloor: priceBelowFloor(rounded, cost, input.rule.minMarginPercent),
    gstMode: input.rule.gstMode,
    rounding: input.rule.rounding,
  }
}

/**
 * One sell price for every surface.
 * Company special, then a corporate catalog line, then a portal fixed price,
 * then the portal rule. A quote override is the frozen line price.
 * The minimum-margin floor is reported, not applied, so a rule is never rewritten.
 */
export function resolvePortalPrice(input: PortalPriceInput): ResolvedPortalPrice {
  const rule = input.rule
  const override = asFinite(input.quoteOverride)
  if (override != null && override >= 0) return finish(override, 'override', input, null)

  if (input.portal !== 'store') {
    const special = asFinite(input.specialPrice)
    if (special != null && special >= 0 && specialPriceActive(input.specialValidUntil, input.today)) {
      return finish(special, 'special', input, null)
    }
  }

  if (input.portal === 'corporate') {
    const manual = asFinite(input.catalogManualPrice)
    if (manual != null && manual >= 0) return finish(manual, 'catalog', input, null)
  }

  const fixed = asFinite(input.portalFixedPrice)
  if (fixed != null && fixed >= 0 && specialPriceActive(input.portalFixedValidUntil, input.today)) {
    return finish(fixed, 'fixed', input, null)
  }

  const retail = asFinite(input.retailPrice)
  const cost = asFinite(input.costPrice)
  const companyMargin = input.portal === 'store' ? null : asFinite(input.companyMarginPercent)
  const margin = companyMargin != null ? companyMargin : asFinite(rule.marginPercent)
  const useCost = rule.base === 'cost'

  if (useCost && cost != null) {
    const price = margin != null ? cost * (1 + margin / 100) : cost
    return finish(price, 'rule', input, margin)
  }

  if (useCost && cost == null && rule.noCostFallback === 'on_quote') {
    return finish(null, 'on_quote', input, margin)
  }

  if (input.portal === 'store' && !useCost) {
    return finish(Math.max(0, retail ?? 0), 'rule', input, null)
  }

  const base = retail ?? 0
  const price = margin != null ? base * (1 + margin / 100) : Math.max(0, base)
  return finish(price, 'rule', input, margin)
}
