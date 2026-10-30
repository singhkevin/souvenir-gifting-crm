import { minimumOrderQty } from '@/lib/business/lines'

export const BUSINESS_CATALOGUE_PATH = '/business/catalogue'
export const BUSINESS_QUOTE_PATH = '/business/quote'
export const BUSINESS_REGISTER_PATH = '/business/register'
export const BUSINESS_LOGIN_PATH = '/business/login'

export function businessLoginPath(next?: string | null, error?: string | null) {
  const params = new URLSearchParams()
  if (next && next.startsWith('/business') && !next.startsWith('/business/login')) params.set('next', next)
  if (error) params.set('error', error)
  const query = params.toString()
  return query ? `${BUSINESS_LOGIN_PATH}?${query}` : BUSINESS_LOGIN_PATH
}

export type StoreChannel = 'retail' | 'business'

export function businessProductPath(id: string) {
  return `${BUSINESS_CATALOGUE_PATH}/${id}`
}

export function businessQuoteSignInPath() {
  return businessLoginPath(BUSINESS_QUOTE_PATH)
}

/** Product page. Business stays under /business. Retail stays on the store catalogue. */
export function channelProductPath(channel: StoreChannel, id: string) {
  return channel === 'business' ? businessProductPath(id) : `/catalogue/${id}`
}

/**
 * Navigation target of a product "Request quote" control.
 * Business adds the line to the quote basket in place, so this is null.
 * Retail opens the store quote form.
 */
export function channelQuoteNavigation(channel: StoreChannel, productId: string) {
  if (channel === 'business') return null
  return `/request-quote?product=${encodeURIComponent(productId)}`
}

export function channelCataloguePath(channel: StoreChannel) {
  return channel === 'business' ? BUSINESS_CATALOGUE_PATH : '/catalogue'
}

/** MOQ is a business-quote fact. The retail store does not show it. */
export function storefrontMoqLine(
  channel: StoreChannel,
  moq: number | null | undefined,
  caption?: string | null,
) {
  if (channel !== 'business') return null
  if (caption) return caption
  return `MOQ ${minimumOrderQty(moq)}`
}
