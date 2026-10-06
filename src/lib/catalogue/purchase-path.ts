/**
 * Buy vs Request quote.
 *
 * The shopper does not pick B2B or B2C. Stock on hand and the product flag decide.
 * Sell-price hiding and catalog kits can still force Request quote.
 *
 *   flag        stock     price     kit     Buy                         Request quote
 *   rfq         any       any       no      no                          yes
 *   auto        0         any       no      no                          yes
 *   auto        n > 0     yes       no      yes, quantity at most n     yes (more than stock)
 *   auto        n > 0     no        no      no                          yes
 *   buy         0         yes       no      yes, quantity uncapped      no
 *   buy         n > 0     yes       no      yes, quantity at most n     yes (more than stock)
 *   buy         any       no        no      no                          yes
 *   any         any       any       yes     no                          yes
 *
 * `buy` with zero stock is the flag override: staff marked the product for immediate
 * purchase even though nothing is on hand. `rfq` ignores stock. `auto` follows stock.
 * A finite stock level is a partial: Buy takes what is on hand, Request quote covers a larger run.
 * Catalog kits stay on Request quote because the kit is one quoted set.
 */

export type FulfillmentMode = 'auto' | 'buy' | 'rfq'

export type PurchaseReason =
  | 'flag-rfq'
  | 'flag-buy'
  | 'stock'
  | 'zero-stock'
  | 'no-price'
  | 'catalog-kit'

export type PurchaseOffer = {
  buy: boolean
  rfq: boolean
  /** Units a Buy checkout may take. Null when Buy is uncapped. */
  maxBuyQty: number | null
  stockQty: number
  mode: FulfillmentMode
  reason: PurchaseReason
}

const MODES = new Set<FulfillmentMode>(['auto', 'buy', 'rfq'])

export function parseFulfillmentMode(value: unknown): FulfillmentMode {
  const mode = String(value || '').trim().toLowerCase()
  return MODES.has(mode as FulfillmentMode) ? (mode as FulfillmentMode) : 'auto'
}

export function parseStockQty(value: unknown): number {
  const stock = Number(value)
  if (!Number.isInteger(stock) || stock < 0) return 0
  return stock
}

export function purchaseOffer(input: {
  fulfillmentMode?: string | null
  stockQty?: number | null
  /** False when that surface is not showing a sell price. */
  hasSellPrice?: boolean
  /** Multi-item catalog kits are quoted as a set. */
  catalogKit?: boolean
}): PurchaseOffer {
  const mode = parseFulfillmentMode(input.fulfillmentMode)
  const stockQty = parseStockQty(input.stockQty)
  const hasSellPrice = input.hasSellPrice !== false

  if (input.catalogKit) {
    return { buy: false, rfq: true, maxBuyQty: null, stockQty, mode, reason: 'catalog-kit' }
  }
  if (mode === 'rfq') {
    return { buy: false, rfq: true, maxBuyQty: null, stockQty, mode, reason: 'flag-rfq' }
  }
  if (!hasSellPrice) {
    return { buy: false, rfq: true, maxBuyQty: null, stockQty, mode, reason: 'no-price' }
  }
  if (mode === 'buy' && stockQty === 0) {
    return { buy: true, rfq: false, maxBuyQty: null, stockQty, mode, reason: 'flag-buy' }
  }
  if (stockQty > 0) {
    return { buy: true, rfq: true, maxBuyQty: stockQty, stockQty, mode, reason: 'stock' }
  }
  return { buy: false, rfq: true, maxBuyQty: null, stockQty, mode, reason: 'zero-stock' }
}

export function purchaseOfferFromProduct(product: {
  fulfillment_mode?: string | null
  fulfillmentMode?: string | null
  stock_qty?: number | null
  stockQty?: number | null
  price?: number | null
  catalogKit?: boolean
}): PurchaseOffer {
  const price = product.price
  return purchaseOffer({
    fulfillmentMode: product.fulfillmentMode ?? product.fulfillment_mode,
    stockQty: product.stockQty ?? product.stock_qty,
    hasSellPrice: price != null && Number.isFinite(Number(price)),
    catalogKit: product.catalogKit,
  })
}

export function purchaseCaption(offer: PurchaseOffer) {
  if (offer.buy && offer.rfq && offer.maxBuyQty != null) {
    return `${offer.maxBuyQty} in stock · quote for more`
  }
  if (offer.buy && offer.maxBuyQty == null) return 'Available to buy'
  if (offer.buy && offer.maxBuyQty != null) return `${offer.maxBuyQty} in stock`
  return 'Request a quote'
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type CheckoutLineInput = {
  productId: string
  quantity: number
  catalogId?: string | null
}

export function normalizeCheckout(lines: CheckoutLineInput[]):
  | { error: string }
  | { catalogId: string | null; lines: { productId: string; quantity: number }[] } {
  if (!lines.length) return { error: 'Your cart is empty' }
  if (lines.length > 50) return { error: 'Checkout up to 50 products at a time' }

  const catalogIds = new Set(lines.map((line) => line.catalogId || null))
  if (catalogIds.size > 1) {
    return { error: 'Check out one catalogue at a time. Clear the cart before adding gifts from another catalogue.' }
  }

  const quantities = new Map<string, number>()
  for (const line of lines) {
    if (!UUID_RE.test(line.productId || '')) return { error: 'A cart item is not a catalogue product' }
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100000) {
      return { error: 'Quantity must be a whole number from 1 to 100000' }
    }
    quantities.set(line.productId, (quantities.get(line.productId) || 0) + line.quantity)
  }

  for (const quantity of quantities.values()) {
    if (quantity > 100000) return { error: 'Quantity must be a whole number from 1 to 100000' }
  }

  return {
    catalogId: [...catalogIds][0] ?? null,
    lines: [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity })),
  }
}

export function directOrderSchemaHint(message: string) {
  if (/place_direct_order|fulfillment_mode|stock_qty/i.test(message)) {
    return `${message} Apply supabase/migrations/20261006_buy_vs_rfq.sql, then retry.`
  }
  return message
}
