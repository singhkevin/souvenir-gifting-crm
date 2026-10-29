import { STORE_CART_KEY, type CartItem } from '@/lib/catalogue/cart'
import { BUSINESS_QUOTE_KEY, minimumOrderQty } from '@/lib/business/lines'

export { BUSINESS_QUOTE_KEY, STORE_CART_KEY }

export type BusinessQuoteDraft = {
  id: string
  sku: string
  name: string
  price: number | null
  image_url?: string | null
  quantity: number
  moq: number
  note?: string
  altQuantities?: number[]
  targetUnitPrice?: number | null
}

/** One business quote line. Price may be null when the visitor cannot see business prices. */
export function businessQuoteLine(input: BusinessQuoteDraft): CartItem {
  const moq = minimumOrderQty(input.moq)
  const quantity = Math.round(Number(input.quantity))
  return {
    id: input.id,
    sku: input.sku,
    name: input.name,
    price: input.price,
    image_url: input.image_url || null,
    quantity: Number.isInteger(quantity) ? quantity : moq,
    maxQuantity: null,
    surface: 'business',
    catalogId: null,
    moq,
    altQuantities: input.altQuantities || [],
    targetUnitPrice: input.targetUnitPrice ?? null,
    note: String(input.note || '').slice(0, 500),
  }
}

/** Replace the same product. Other lines stay. Does not read or write the retail cart. */
export function upsertBusinessQuoteLine(items: CartItem[], line: CartItem): CartItem[] {
  return [...items.filter((item) => item.id !== line.id), { ...line, surface: 'business' }]
}
