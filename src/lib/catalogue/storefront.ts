import { purchaseOffer, type PurchaseOffer } from '@/lib/catalogue/purchase-path'

export const SHOP_MODE_COOKIE = 'gf-shop'

export const STORE_OCCASIONS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'festive', label: 'Festive' },
  { id: 'onboarding', label: 'Onboarding' },
  { id: 'client', label: 'Client appreciation' },
  { id: 'conference', label: 'Conference' },
  { id: 'anniversary', label: 'Work anniversary' },
] as const

export type ShopMode = 'retail' | 'corporate'

export function shopModeFromCookie(value: string | null | undefined): ShopMode {
  return value === 'corporate' ? 'corporate' : 'retail'
}

/**
 * Retail store: an in-stock gift with a price is bought at products.price, from quantity 1 up to stock.
 * Sample-only gifts stay unsellable. The rfq flag is left as the business-mode quote signal.
 */
export function storefrontSampleOffer(input: {
  fulfillmentMode?: string | null
  stockQty?: number | null
  hasSellPrice?: boolean
  catalogKit?: boolean
  sampleOnly?: boolean
}): PurchaseOffer {
  const offer = purchaseOffer(input)
  if (input.sampleOnly || offer.reason === 'sample') {
    return { ...offer, buy: false, maxBuyQty: null, reason: 'sample' }
  }
  if (!offer.buy || offer.stockQty < 1) {
    return { ...offer, buy: false, maxBuyQty: null }
  }
  return { ...offer, buy: true, maxBuyQty: offer.stockQty }
}

export function storeSampleQuantityError(quantities: number[]) {
  if (quantities.some((quantity) => !Number.isInteger(quantity) || quantity < 1)) {
    return 'Choose a quantity of at least 1.'
  }
  return null
}

export type RetailAvailability = 'buy' | 'sample' | 'out' | 'closed'

/** What a retail shopper can do. Quotes are not a retail action. */
export function retailAvailability(offer: PurchaseOffer): RetailAvailability {
  if (offer.reason === 'sample') return 'sample'
  if (offer.buy) return 'buy'
  if (offer.reason === 'catalog-kit' || offer.reason === 'flag-rfq' || offer.reason === 'no-price') return 'closed'
  return 'out'
}

export function retailStatusLabel(offer: PurchaseOffer) {
  const state = retailAvailability(offer)
  if (state === 'buy') return offer.maxBuyQty != null ? `${offer.maxBuyQty} in stock` : 'In stock'
  if (state === 'sample') return 'Sample only'
  if (state === 'out') return 'Out of stock'
  return 'Not available to buy'
}

export function occasionTagList(value: unknown): string[] {
  const allowed = new Set<string>(STORE_OCCASIONS.map((item) => item.id))
  const raw = Array.isArray(value) ? value : []
  return [...new Set(raw.map((item) => String(item)))].filter((item) => allowed.has(item))
}
