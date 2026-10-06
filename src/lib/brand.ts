/**
 * User-facing product name and public origins.
 * Defaults match production (www.giftingstore.online). NEXT_PUBLIC_* overrides
 * are read at call time so a host panel value is visible without a code change.
 * Direct `process.env.NEXT_PUBLIC_*` access lets Next inline these in the client.
 *
 * Company portal routing still uses server-only ROOT_DOMAIN in portal-host.ts.
 * Unset ROOT_DOMAIN keeps every host on the main site.
 */

export const DEFAULT_APP_NAME = 'Souvenir - Gifting Solutions'
export const DEFAULT_APP_SHORT_NAME = 'Souvenir'
export const PRODUCTION_ROOT_DOMAIN = 'giftingstore.online'
export const PRODUCTION_SITE_URL = 'https://www.giftingstore.online'

/** Old example / placeholder values. They are not a product name. */
const IGNORED_NAMES = new Set([
  'gifting solutions',
  'giffter',
  'giffter crm',
  'oaklane',
  'oaklane crm',
  'souvenir-gifting-crm',
  'souvenir gifting crm',
])

const PLACEHOLDER_SITE_HOSTS = new Set(['souvenir-gifting-crm.vercel.app'])

function trimmed(value: string | undefined) {
  return typeof value === 'string' ? value.trim() : ''
}

function acceptedName(value: string | undefined, fallback: string) {
  const next = trimmed(value)
  if (!next || IGNORED_NAMES.has(next.toLowerCase())) return fallback
  return next
}

export function appName() {
  return acceptedName(process.env.NEXT_PUBLIC_APP_NAME, DEFAULT_APP_NAME)
}

export function appShortName() {
  return acceptedName(process.env.NEXT_PUBLIC_APP_SHORT_NAME, DEFAULT_APP_SHORT_NAME)
}

/** Canonical public origin. Apex giftingstore.online is the same CRM. */
export function publicSiteUrl() {
  const explicit = trimmed(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, '')
  if (!explicit) return PRODUCTION_SITE_URL
  try {
    const url = new URL(explicit)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return PRODUCTION_SITE_URL
    if (PLACEHOLDER_SITE_HOSTS.has(url.host.toLowerCase())) return PRODUCTION_SITE_URL
    return explicit
  } catch {
    return PRODUCTION_SITE_URL
  }
}

/**
 * Optional marketing origin (for example https://souvenirgifting.com).
 * Empty unless NEXT_PUBLIC_MARKETING_URL is a valid absolute URL.
 * Not the portal root and not an auth redirect host.
 */
export function marketingSiteUrl() {
  const explicit = trimmed(process.env.NEXT_PUBLIC_MARKETING_URL).replace(/\/$/, '')
  if (!explicit) return ''
  try {
    const url = new URL(explicit)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return explicit
  } catch {
    return ''
  }
}

export function marketingHostLabel(url = marketingSiteUrl()) {
  if (!url) return ''
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Designed wordmark splits "Souvenir - Gifting Solutions" around the bar. */
export function brandWordmark(name = appName()) {
  const match = name.match(/^(.+?)\s+-\s+(.+)$/)
  if (!match) return { lead: name, rest: null as string | null }
  return { lead: match[1], rest: match[2] }
}
