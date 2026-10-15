import { roundMoney } from '@/lib/pricing/resolve'

function asFinite(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** A blank end date means the special price stays on. An end date includes that day. */
export function specialPriceActive(validUntil: string | null | undefined, today = new Date()): boolean {
  if (!validUntil) return true
  const end = String(validUntil).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return true
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return end >= stamp
}

export type SurfacePriceInput = {
  /** b2c is the store retail price. b2b follows the company ladder below. */
  channel: 'b2c' | 'b2b'
  retailPrice?: number | null
  specialPrice?: number | null
  specialValidUntil?: string | null
  catalogManualPrice?: number | null
  companyMarginPercent?: number | null
  /**
   * Admin quote-line override. When set, every later surface (quote, order, email, PDF)
   * keeps this amount and does not recompute it.
   */
  quoteOverride?: number | null
  today?: Date
}

/**
 * One sell price for every surface.
 * A quote-line override wins.
 * B2C is the store retail price (`products.price`).
 * B2B is the company special, then the catalog line manual price, then retail plus that company's margin.
 */
export function surfaceUnitPrice(input: SurfacePriceInput): number {
  const override = asFinite(input.quoteOverride)
  if (override != null && override >= 0) return roundMoney(override)
  if (input.channel === 'b2c') {
    return roundMoney(Math.max(0, asFinite(input.retailPrice) ?? 0))
  }
  const special = asFinite(input.specialPrice)
  if (special != null && special >= 0 && specialPriceActive(input.specialValidUntil, input.today)) {
    return roundMoney(special)
  }
  const manual = asFinite(input.catalogManualPrice)
  if (manual != null && manual >= 0) return roundMoney(manual)
  const base = asFinite(input.retailPrice) ?? 0
  const margin = asFinite(input.companyMarginPercent)
  if (margin != null) return roundMoney(base * (1 + margin / 100))
  return roundMoney(Math.max(0, base))
}

/** B2B ladder. Store retail and quote overrides go through surfaceUnitPrice. */
export function listedUnitPrice(input: {
  specialPrice?: number | null
  specialValidUntil?: string | null
  catalogManualPrice?: number | null
  basePrice?: number | null
  companyMarginPercent?: number | null
  today?: Date
}): number {
  return surfaceUnitPrice({
    channel: 'b2b',
    retailPrice: input.basePrice,
    specialPrice: input.specialPrice,
    specialValidUntil: input.specialValidUntil,
    catalogManualPrice: input.catalogManualPrice,
    companyMarginPercent: input.companyMarginPercent,
    today: input.today,
  })
}
