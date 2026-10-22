/**
 * Per-channel product visibility.
 *
 * Each product has three independent switches:
 *   Retail store  (products.show_in_store)    public store, /catalogue, search, homepage
 *   Business      (products.show_in_business) /business portal for registered businesses
 *   Corporate     (products.catalogue_access) all / selected / none for corporate /portal,
 *                 client catalogues and microsites (plus company grants and exclusions)
 *
 * Before 20261022_channel_visibility.sql the store and business portal used
 * catalogue_access = 'all', so "Selected companies" also hid a product from retail.
 * When the new columns are missing (null or undefined), the store and business flags
 * fall back to that legacy rule, so nothing appears or disappears before or after the
 * migration: the backfill sets both flags to (catalogue_access = 'all').
 */

export type Channel = 'store' | 'business'
export type CorporateAccess = 'all' | 'selected' | 'none'

export type ChannelProduct = {
  status?: string | null
  catalogue_access?: string | null
  show_in_store?: boolean | null
  show_in_business?: boolean | null
}

export const CHANNEL_COLUMN: Record<Channel, 'show_in_store' | 'show_in_business'> = {
  store: 'show_in_store',
  business: 'show_in_business',
}

export const CHANNEL_MIGRATION = '20261022_channel_visibility.sql'

/** Legacy rule: store and business showed only corporate "All companies" products. */
export function legacyChannelDefault(catalogueAccess: string | null | undefined): boolean {
  return (catalogueAccess ?? 'all') === 'all'
}

export function channelFlag(product: ChannelProduct, channel: Channel): boolean {
  const value = product[CHANNEL_COLUMN[channel]]
  if (typeof value === 'boolean') return value
  return legacyChannelDefault(product.catalogue_access)
}

/** Active and switched on for the retail store or business portal. */
export function visibleOnChannel(product: ChannelProduct, channel: Channel): boolean {
  if (product.status !== 'active') return false
  return channelFlag(product, channel)
}

export function parseCorporateAccess(value: unknown): CorporateAccess | null {
  const raw = String(value ?? '').trim()
  if (raw === 'all' || raw === 'selected' || raw === 'none') return raw
  return null
}

/** Legacy products.visibility mirror of catalogue_access. */
export function legacyVisibilityLabel(access: CorporateAccess): string {
  return access === 'all' ? 'catalogue' : access === 'selected' ? 'selected_companies' : 'internal_only'
}

/** True when a Supabase error says the channel columns do not exist yet. */
export function channelColumnsMissing(message: string | null | undefined): boolean {
  return Boolean(message && /show_in_store|show_in_business/i.test(message))
}

/** Whether a row read with select('*') carries the channel columns. */
export function hasChannelColumns(row: Record<string, unknown> | null | undefined): boolean {
  return Boolean(row && 'show_in_store' in row && 'show_in_business' in row)
}

const YES = new Set(['yes', 'y', 'true', '1', 'on', 'show', 'visible'])
const NO = new Set(['no', 'n', 'false', '0', 'off', 'hide', 'hidden'])

/**
 * CSV cell for Retail or Business. Blank keeps the legacy rule, so an import of
 * corporate-only rows does not suddenly appear on the public store.
 */
export function parseChannelCell(
  raw: string | null | undefined,
  catalogueAccess: CorporateAccess,
): { ok: true; value: boolean } | { ok: false } {
  const value = String(raw ?? '').trim().toLowerCase()
  if (!value) return { ok: true, value: legacyChannelDefault(catalogueAccess) }
  if (YES.has(value)) return { ok: true, value: true }
  if (NO.has(value)) return { ok: true, value: false }
  return { ok: false }
}

export type ChannelSummary = {
  store: boolean
  business: boolean
  corporate: CorporateAccess
  companyCount: number
}

export function channelSummary(product: ChannelProduct, companyCount = 0): ChannelSummary {
  return {
    store: channelFlag(product, 'store'),
    business: channelFlag(product, 'business'),
    corporate: parseCorporateAccess(product.catalogue_access) ?? 'all',
    companyCount,
  }
}

export function corporateLabel(summary: Pick<ChannelSummary, 'corporate' | 'companyCount'>): string {
  if (summary.corporate === 'all') return 'All companies'
  if (summary.corporate === 'selected') {
    return `${summary.companyCount} ${summary.companyCount === 1 ? 'company' : 'companies'}`
  }
  return 'None'
}
