/** Sell-price resolution: cost × (1 + margin%/100) with legacy list-price fallback. */

export type PriceChannel = 'b2c' | 'b2b'

export type MarginSettings = {
  default_margin_percent: number | null
  b2c_margin_percent: number | null
  b2b_margin_percent: number | null
}

export type PriceInputs = {
  supplierCost: number | null | undefined
  listPrice: number | null | undefined
  /** Product-level margin % override (products.internal_margin). */
  productMarginPercent: number | null | undefined
  /** Company-level margin % (B2B only). */
  companyMarginPercent?: number | null | undefined
  channel: PriceChannel
  settings?: MarginSettings | null
}

export type ResolvedPrice = {
  sellPrice: number
  marginPercent: number | null
  usedCost: boolean
}

function asFinite(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function resolveMarginPercent(input: {
  companyMarginPercent?: number | null
  productMarginPercent?: number | null
  channel: PriceChannel
  settings?: MarginSettings | null
}): number | null {
  // Company (B2B only) → channel → product → global.
  // A product margin must not flatten B2C and B2B to the same price.
  if (input.channel === 'b2b') {
    const company = asFinite(input.companyMarginPercent)
    if (company != null) return company
  }

  const settings = input.settings
  const channelMargin = settings
    ? input.channel === 'b2c'
      ? asFinite(settings.b2c_margin_percent)
      : asFinite(settings.b2b_margin_percent)
    : null
  if (channelMargin != null) return channelMargin

  const product = asFinite(input.productMarginPercent)
  if (product != null) return product

  return asFinite(settings?.default_margin_percent)
}

/** Round to paise (2 dp), matching Postgres round(..., 2). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function resolveSellPrice(input: PriceInputs): ResolvedPrice {
  const cost = asFinite(input.supplierCost)
  const list = asFinite(input.listPrice)
  const marginPercent = resolveMarginPercent({
    companyMarginPercent: input.companyMarginPercent,
    productMarginPercent: input.productMarginPercent,
    channel: input.channel,
    settings: input.settings,
  })

  const base = cost ?? list
  if (base != null && marginPercent != null) {
    return {
      sellPrice: roundMoney(base * (1 + marginPercent / 100)),
      marginPercent,
      usedCost: cost != null,
    }
  }

  return {
    sellPrice: roundMoney(base ?? 0),
    marginPercent,
    usedCost: false,
  }
}
