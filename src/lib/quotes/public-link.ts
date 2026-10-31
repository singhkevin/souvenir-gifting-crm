import { createHmac, timingSafeEqual } from 'node:crypto'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { adminHost, mainOrigin, portalUrlForSlug } from '@/lib/portal-host'
import { storePublicOrigin } from '@/lib/site/store-public-origin'

/**
 * Customer quotation links. Do not import this from a client component:
 * the view token is an HMAC of the quotation id.
 *
 * Business accounts open the quote on the store, after sign-in.
 * A company with a portal slug opens it on that portal, after sign-in.
 * With the domain split off, a company without a slug still uses the single
 * site's portal page, which sends a signed-out visitor to log in and back.
 * With the split on, that portal path does not exist on any customer host.
 * Those recipients (no portal, including direct and individual customers)
 * get a view-only link on the store. The token is not a login and cannot
 * accept the quote. The raw request host is never used, so the admin host
 * cannot leak into the email.
 */

const TOKEN_PREFIX = 'quote-view:v1:'

export function quoteViewSecret() {
  return (process.env.QUOTE_VIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
}

export function quoteViewToken(quotationId: string, secret: string) {
  return createHmac('sha256', secret).update(`${TOKEN_PREFIX}${quotationId}`).digest('base64url')
}

export function quoteViewTokenMatches(quotationId: string, token: string | null | undefined, secret: string) {
  if (!quotationId || !token || !secret) return false
  const expected = quoteViewToken(quotationId, secret)
  const left = Buffer.from(token)
  const right = Buffer.from(expected)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function customerQuoteCheckoutUrl(token: string) {
  return `${storePublicOrigin(null)}/catalogue/checkout?quote=${encodeURIComponent(token)}`
}

export function clientQuoteUrl(input: {
  accountType: string | null | undefined
  portalSlug: string | null | undefined
  quotationId: string
  publicToken?: string | null
}) {
  const id = input.quotationId
  if (input.accountType === 'business') {
    return `${storePublicOrigin(null)}/business/quotes/${id}`
  }
  const portal = portalUrlForSlug(input.portalSlug)
  if (portal) return `${portal}/portal/quotations/${id}`
  if (!domainSplitEnabled()) return `${mainOrigin(null)}/portal/quotations/${id}`
  if (!input.publicToken) return null
  const url = new URL(`/quotes/${id}`, storePublicOrigin(null))
  url.searchParams.set('t', input.publicToken)
  return url.toString()
}

/** Absolute customer URL. `origin` is accepted and ignored so callers cannot point this at the admin host. */
export function absoluteClientQuoteUrl(input: {
  accountType: string | null | undefined
  portalSlug: string | null | undefined
  quotationId: string
  origin?: string
}) {
  const business = input.accountType === 'business'
  const portal = business ? null : portalUrlForSlug(input.portalSlug)
  const needsPublic = !business && !portal && domainSplitEnabled()
  const secret = needsPublic ? quoteViewSecret() : ''
  const token = needsPublic && secret ? quoteViewToken(input.quotationId, secret) : null
  const url = clientQuoteUrl({
    accountType: input.accountType,
    portalSlug: input.portalSlug,
    quotationId: input.quotationId,
    publicToken: token,
  })
  if (!url) return ''
  const admin = adminHost()
  if (admin && new URL(url).hostname === admin) return ''
  return url
}
