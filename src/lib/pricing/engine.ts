import { specialPriceActive } from '@/lib/pricing/listed'
import type { ResolvedCostSource } from '@/lib/pricing/cost-basis'
import { roundMoney } from '@/lib/pricing/resolve'

/** Store, the business portal, and the corporate portal (company portal, microsite, catalogs). */
export type PricingPortal = 'store' | 'business' | 'corporate'

export type RoundingMode = 'none' | 'whole' | 'end9' | 'end99'
export type GstMode = 'inclusive' | 'exclusive'
export type PriceSource = 'override' | 'special' | 'catalog' | 'fixed' | 'rule' | 'on_quote'

/**
 * One portal's defaults. Every rule price is cost plus a margin; there is no retail base.
 * A product without a cost is priced on quote.
 */
export type PortalRule = {
  /** Default margin over cost for the portal. Null means cost as-is. */
  marginPercent: number | null
  rounding: RoundingMode
  gstMode: GstMode
  showPrices: boolean
  /** Warn in admin. Block saving a fixed price below cost plus this percent. Does not rewrite a price. */
  minMarginPercent: number
  /** Cost basis for products set to portal_default. */
  costSource: ResolvedCostSource
}

/** Fallback rules when org_settings cannot be read: cost as-is, paise rounding, nothing hidden. */
export const SEEDED_PORTAL_RULES: Record<PricingPortal, PortalRule> = {
  store: {
    marginPercent: null,
    rounding: 'none',
    gstMode: 'inclusive',
    showPrices: true,
    minMarginPercent: 0,
    costSource: 'manual',
  },
  business: {
    marginPercent: null,
    rounding: 'none',
    gstMode: 'exclusive',
    showPrices: true,
    minMarginPercent: 0,
    costSource: 'manual',
  },
  corporate: {
    marginPercent: 0,
    rounding: 'none',
    gstMode: 'exclusive',
    showPrices: true,
    minMarginPercent: 0,
    costSource: 'manual',
  },
}

/** Store and Retail are one concept: the retail store price. */
export const PORTAL_LABEL: Record<PricingPortal, string> = {
  store: 'Retail',
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
  /** The effective cost (see cost-basis.ts). Missing cost means price on quote. */
  costPrice?: number | null
  companyMarginPercent?: number | null
  /** Margin for this product on this portal. Below the company margin, above the portal default. */
  productMarginPercent?: number | null
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
  /** The margin the rule used: company, then product, then portal default. Null for fixed prices. */
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
 * One sell price for every surface. Mirrors public.portal_unit_price.
 * Locked quote price, then company fixed price, then corporate catalog manual price, then portal fixed price,
 * then cost plus the company margin, else the product's portal margin, else the portal default margin.
 * Pack lines keep their stored catalog price and do not come through here.
 * No cost means price on quote. The minimum-margin floor is reported, not applied.
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

  const cost = asFinite(input.costPrice)
  const companyMargin = input.portal === 'store' ? null : asFinite(input.companyMarginPercent)
  const margin = companyMargin ?? asFinite(input.productMarginPercent) ?? asFinite(rule.marginPercent)
  if (cost == null) return finish(null, 'on_quote', input, margin)
  const price = margin != null ? cost * (1 + margin / 100) : cost
  return finish(price, 'rule', input, margin)
}
