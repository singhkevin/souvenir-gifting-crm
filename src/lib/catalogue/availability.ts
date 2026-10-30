import {
  parseFulfillmentMode,
  parseStockQty,
  type FulfillmentMode,
  type PurchaseOffer,
  type PurchaseReason,
} from '@/lib/catalogue/purchase-path'

/**
 * Retail stock availability. One helper decides what the store can sell now
 * and what has to be arranged.
 *
 * In-hand units are the ones the existing store checkout can charge today:
 * a sell price, fulfillment auto or buy, and stock on hand. Quantity above
 * that, and anything with no stock, is a backorder. Sample-only products are
 * not offered (they stay in the staff sample register).
 *
 * `fulfillment_mode = buy` with zero stock is still an immediate purchase
 * inside `place_direct_order` for other callers. The retail store does not
 * use that override: nothing on hand is arranged, not paid for.
 */

export type RetailAvailabilityReason = Extract<
  PurchaseReason,
  'sample' | 'catalog-kit' | 'flag-rfq' | 'no-price' | 'stock' | 'zero-stock'
>

export type RetailAvailability = {
  /** False only for sample-only products, which the store must not offer. */
  offered: boolean
  /** Units that can go through the existing paid checkout. */
  inHand: number
  reason: RetailAvailabilityReason
}

export function retailAvailability(input: {
  stockQty?: number | null
  fulfillmentMode?: string | null
  hasSellPrice?: boolean
  sampleOnly?: boolean
  catalogKit?: boolean
}): RetailAvailability {
  const mode = parseFulfillmentMode(input.fulfillmentMode)
  const stock = parseStockQty(input.stockQty)
  const hasSellPrice = input.hasSellPrice !== false

  if (input.sampleOnly) return { offered: false, inHand: 0, reason: 'sample' }
  if (input.catalogKit) return { offered: true, inHand: 0, reason: 'catalog-kit' }
  if (mode === 'rfq') return { offered: true, inHand: 0, reason: 'flag-rfq' }
  if (!hasSellPrice) return { offered: true, inHand: 0, reason: 'no-price' }
  if (stock > 0) return { offered: true, inHand: stock, reason: 'stock' }
  return { offered: true, inHand: 0, reason: 'zero-stock' }
}

/** Purchase offer for a retail card: any offered product can be added to the cart. */
export function retailCartOffer(input: {
  fulfillmentMode?: string | null
  stockQty?: number | null
  hasSellPrice?: boolean
  sampleOnly?: boolean
  catalogKit?: boolean
}): PurchaseOffer {
  const mode: FulfillmentMode = parseFulfillmentMode(input.fulfillmentMode)
  const availability = retailAvailability(input)
  if (!availability.offered) {
    return { buy: false, rfq: false, maxBuyQty: null, stockQty: 0, mode, reason: 'sample' }
  }
  return {
    buy: true,
    rfq: false,
    maxBuyQty: null,
    stockQty: availability.inHand,
    mode,
    reason: availability.reason,
  }
}

export function retailLineCaption(inHand: number) {
  return inHand > 0 ? `${inHand} in hand` : 'To arrange'
}

/** Drop sample-only rows from the retail catalogue. Other channels are unchanged. */
export function visibleOnRetailStore<T extends { sample_only?: boolean | null }>(rows: T[]): T[] {
  return rows.filter((row) => !row.sample_only)
}

export type RetailSplitLine = {
  id: string
  quantity: number
  /** Sellable units already resolved. Omit when the cart has no snapshot. */
  stockQty?: number | null
  fulfillmentMode?: string | null
  hasSellPrice?: boolean
  sampleOnly?: boolean
  catalogKit?: boolean
}

export type SplitPiece<T> = T & { quantity: number; kind: 'in_stock' | 'backorder' }

/**
 * Split each cart line into the units to charge now and the units to arrange.
 * A legacy store line with no stock snapshot stays in stock when `unknownIsInStock` is set.
 */
export function splitRetailCart<T extends RetailSplitLine>(
  lines: T[],
  options?: { unknownIsInStock?: boolean },
): { inStock: SplitPiece<T>[]; backorder: SplitPiece<T>[]; hidden: T[] } {
  const inStock: SplitPiece<T>[] = []
  const backorder: SplitPiece<T>[] = []
  const hidden: T[] = []

  for (const line of lines) {
    const quantity = Math.max(0, Math.round(Number(line.quantity) || 0))
    if (quantity < 1) continue

    const unknown =
      options?.unknownIsInStock &&
      (line.stockQty == null) &&
      !line.sampleOnly &&
      !line.catalogKit &&
      line.fulfillmentMode == null &&
      line.hasSellPrice == null

    if (unknown) {
      inStock.push({ ...line, quantity, kind: 'in_stock' })
      continue
    }

    const availability = retailAvailability({
      stockQty: line.stockQty,
      fulfillmentMode: line.fulfillmentMode,
      hasSellPrice: line.hasSellPrice,
      sampleOnly: line.sampleOnly,
      catalogKit: line.catalogKit,
    })
    if (!availability.offered) {
      hidden.push(line)
      continue
    }

    const sell = Math.min(quantity, availability.inHand)
    const arrange = quantity - sell
    if (sell > 0) inStock.push({ ...line, quantity: sell, kind: 'in_stock' })
    if (arrange > 0) backorder.push({ ...line, quantity: arrange, kind: 'backorder' })
  }

  return { inStock, backorder, hidden }
}
