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

/**
 * Client price order:
 * company special price, then a catalog line's manual price, then base price marked up by the company margin.
 * Margin is a percent: base × (1 + margin / 100). No company margin leaves the base price as-is.
 */
export function listedUnitPrice(input: {
  specialPrice?: number | null
  specialValidUntil?: string | null
  catalogManualPrice?: number | null
  basePrice?: number | null
  companyMarginPercent?: number | null
  today?: Date
}): number {
  const special = asFinite(input.specialPrice)
  if (special != null && special >= 0 && specialPriceActive(input.specialValidUntil, input.today)) {
    return roundMoney(special)
  }
  const manual = asFinite(input.catalogManualPrice)
  if (manual != null && manual >= 0) return roundMoney(manual)
  const base = asFinite(input.basePrice) ?? 0
  const margin = asFinite(input.companyMarginPercent)
  if (margin != null) return roundMoney(base * (1 + margin / 100))
  return roundMoney(Math.max(0, base))
}
