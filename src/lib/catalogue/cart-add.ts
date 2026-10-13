import { isUuid } from '@/lib/utils'
import type { PurchaseOffer } from '@/lib/catalogue/purchase-path'

export const MAX_CART_ADD = 50

export type CartAddRequest = { id: string; quantity: number }

export type CartAddProduct = {
  id: string
  purchase: PurchaseOffer
}

export function parseCartAddQuery(raw: string | null | undefined): CartAddRequest[] {
  const text = String(raw || '').trim()
  if (!text) return []
  const out: CartAddRequest[] = []
  for (const part of text.split(',')) {
    const [id, qtyRaw] = part.split(':')
    const idTrim = (id || '').trim()
    if (!isUuid(idTrim)) continue
    const quantity = Math.round(Number(qtyRaw))
    if (!Number.isInteger(quantity) || quantity < 1) continue
    out.push({ id: idTrim, quantity })
    if (out.length === MAX_CART_ADD) break
  }
  return out
}

export function planStoreCartAdd(requests: CartAddRequest[], products: CartAddProduct[]) {
  const byId = new Map(products.map((product) => [product.id, product]))
  const added: { id: string; quantity: number }[] = []
  const skipped: string[] = []
  const limited = requests.slice(0, MAX_CART_ADD)
  if (requests.length > MAX_CART_ADD) skipped.push('Only the first 50 items can be added at once.')
  for (const request of limited) {
    const product = byId.get(request.id)
    if (!product || !product.purchase.buy) {
      skipped.push('A selected item is not available to buy on the store.')
      continue
    }
    let quantity = request.quantity
    if (product.purchase.maxBuyQty != null) quantity = Math.min(quantity, product.purchase.maxBuyQty)
    if (quantity < 1) {
      skipped.push('A selected item has no stock left to buy.')
      continue
    }
    added.push({ id: request.id, quantity })
  }
  return { added, skipped: [...new Set(skipped)] }
}
