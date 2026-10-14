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

/** One sample from stock. Out of stock, quote-only, and kits stay on Request a quote. */
export function storefrontSampleOffer(input: {
  fulfillmentMode?: string | null
  stockQty?: number | null
  hasSellPrice?: boolean
  catalogKit?: boolean
}): PurchaseOffer {
  const offer = purchaseOffer(input)
  if (!offer.buy || offer.stockQty < 1 || offer.maxBuyQty == null) {
    return { ...offer, buy: false, rfq: true, maxBuyQty: null }
  }
  return { ...offer, buy: true, rfq: true, maxBuyQty: 1 }
}

export function storeSampleQuantityError(quantities: number[]) {
  if (quantities.some((quantity) => quantity !== 1)) {
    return 'The store sells one sample of each gift. Request a quote for a larger order.'
  }
  return null
}

export function occasionTagList(value: unknown): string[] {
  const allowed = new Set<string>(STORE_OCCASIONS.map((item) => item.id))
  const raw = Array.isArray(value) ? value : []
  return [...new Set(raw.map((item) => String(item)))].filter((item) => allowed.has(item))
}
