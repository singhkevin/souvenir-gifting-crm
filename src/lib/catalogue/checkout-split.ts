import { retailAvailability, type RetailAvailabilityReason } from '@/lib/catalogue/availability'

export type CheckoutStockProduct = {
  id: string
  name: string
  sku: string | null
  stockQty: number | null
  fulfillmentMode: string | null
  sampleOnly: boolean
  hasSellPrice: boolean
  onStore: boolean
  active: boolean
}

export type CheckoutRequestLine = { productId: string; quantity: number }

export type PreparedRetailCheckout =
  | { error: string }
  | {
      inStock: CheckoutRequestLine[]
      backorder: (CheckoutRequestLine & { name: string; sku: string | null; reason: RetailAvailabilityReason })[]
    }

/**
 * Split a retail cart before checkout.
 * In-stock lines are the only ones passed to the existing paid order.
 * The rest become one arrangement request. Sample-only products are refused.
 */
export function prepareRetailCheckout(
  lines: CheckoutRequestLine[],
  products: CheckoutStockProduct[],
): PreparedRetailCheckout {
  if (!lines.length) return { error: 'Your cart is empty' }
  const byId = new Map(products.map((product) => [product.id, product]))
  const inStock: CheckoutRequestLine[] = []
  const backorder: (CheckoutRequestLine & { name: string; sku: string | null; reason: RetailAvailabilityReason })[] = []

  for (const line of lines) {
    const product = byId.get(line.productId)
    if (!product || !product.active || !product.onStore) {
      return { error: 'A product in this order is no longer available' }
    }
    const availability = retailAvailability({
      stockQty: product.stockQty,
      fulfillmentMode: product.fulfillmentMode,
      hasSellPrice: product.hasSellPrice,
      sampleOnly: product.sampleOnly,
    })
    if (!availability.offered) {
      return { error: 'Samples are not sold on the store.' }
    }
    const quantity = line.quantity
    const sell = Math.min(quantity, availability.inHand)
    const arrange = quantity - sell
    if (sell > 0) inStock.push({ productId: product.id, quantity: sell })
    if (arrange > 0) {
      backorder.push({
        productId: product.id,
        quantity: arrange,
        name: product.name,
        sku: product.sku,
        reason: availability.reason,
      })
    }
  }

  if (!inStock.length && !backorder.length) return { error: 'Your cart is empty' }
  return { inStock, backorder }
}
