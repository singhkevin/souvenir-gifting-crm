import { roundMoney } from '@/lib/pricing/resolve'

/** Staff who can skip the quotation and create the order from the requirement. */
export const DIRECT_ORDER_ROLES = ['admin', 'sales', 'management'] as const

/** Same rate createQuotationFromRequirement stores on a draft. GST is added once. */
export const DIRECT_ORDER_GST_PERCENT = 18

export type DirectOrderProduct = {
  productId: string
  name: string
  quantity: number
}

export type DirectOrderLine = {
  productId: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

export type DirectOrderTotals = {
  subtotal: number
  tax: number
  total: number
}

export function directOrderTotals(lines: { quantity: number; unitPrice: number }[]): DirectOrderTotals {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + roundMoney(line.quantity * line.unitPrice), 0))
  const tax = roundMoney(subtotal * (DIRECT_ORDER_GST_PERCENT / 100))
  return { subtotal, tax, total: roundMoney(subtotal + tax) }
}

/**
 * Confirms one sell price per requirement product. Quantities come from the
 * requirement. Prices are ex-GST. A missing, zero, or negative price is rejected.
 */
export function parseDirectOrderPrices(
  products: DirectOrderProduct[],
  prices: Record<string, unknown>,
): { ok: true; lines: DirectOrderLine[]; totals: DirectOrderTotals } | { ok: false; error: string } {
  if (!products.length) return { ok: false, error: 'Add at least one product before creating an order' }
  const lines: DirectOrderLine[] = []
  for (const product of products) {
    if (!(product.quantity > 0)) return { ok: false, error: `${product.name} needs a quantity` }
    const raw = prices[product.productId]
    const amount = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: `Enter a sell price for ${product.name}` }
    }
    const unitPrice = roundMoney(amount)
    if (!(unitPrice > 0)) return { ok: false, error: `Enter a sell price for ${product.name}` }
    lines.push({
      productId: product.productId,
      quantity: product.quantity,
      unitPrice,
      lineTotal: roundMoney(product.quantity * unitPrice),
    })
  }
  return { ok: true, lines, totals: directOrderTotals(lines) }
}
