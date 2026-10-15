export type CartSurface = 'store' | 'portal' | 'microsite' | 'catalog' | 'business'

export type CartItem = {
  id: string
  sku: string
  name: string
  price?: number | null
  image_url?: string | null
  quantity: number
  /** Null when the Buy flag allows any quantity. */
  maxQuantity: number | null
  surface: CartSurface
  catalogId?: string | null
  moq?: number
  altQuantities?: number[]
  targetUnitPrice?: number | null
  note?: string
}

export const STORE_CART_KEY = 'giffter_cart'
export const BUSINESS_QUOTE_KEY = 'giffter_business_quote'

function normalize(item: unknown): CartItem | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  if (!raw.id && !raw.sku) return null
  if (!raw.name) return null
  const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1))
  const maxRaw = raw.maxQuantity
  const maxQuantity =
    maxRaw == null || maxRaw === ''
      ? null
      : Math.max(1, Math.round(Number(maxRaw) || 1))
  const surface = raw.surface === 'portal' || raw.surface === 'microsite' || raw.surface === 'catalog' || raw.surface === 'business'
    ? raw.surface
    : 'store'
  const moq = Math.max(1, Math.round(Number(raw.moq) || 1))
  const altQuantities = Array.isArray(raw.altQuantities)
    ? raw.altQuantities.map((value) => Math.round(Number(value))).filter((value) => Number.isInteger(value) && value > 0).slice(0, 3)
    : []
  const targetRaw = raw.targetUnitPrice
  const targetUnitPrice = targetRaw == null || targetRaw === '' || !Number.isFinite(Number(targetRaw)) ? null : Number(targetRaw)
  return {
    id: String(raw.id || raw.sku),
    sku: String(raw.sku || raw.id),
    name: String(raw.name),
    price: raw.price == null ? null : Number(raw.price),
    image_url: raw.image_url ? String(raw.image_url) : null,
    quantity: surface === 'business'
      ? Math.min(100000, Math.max(moq, maxQuantity != null ? Math.min(quantity, maxQuantity) : quantity))
      : maxQuantity != null ? Math.min(quantity, maxQuantity) : quantity,
    maxQuantity,
    surface,
    catalogId: raw.catalogId ? String(raw.catalogId) : null,
    ...(surface === 'business'
      ? { moq, altQuantities, targetUnitPrice, note: raw.note ? String(raw.note).slice(0, 500) : '' }
      : {}),
  }
}

export function readCart(key = STORE_CART_KEY): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalize).filter((item): item is CartItem => item !== null)
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[], key = STORE_CART_KEY) {
  localStorage.setItem(key, JSON.stringify(items))
  window.dispatchEvent(new Event('giffter-cart-change'))
}

/** Number of distinct products in the cart (not the sum of their quantities). */
export function getCartCount(items?: CartItem[]): number {
  return (items || readCart()).length
}

export type CartDraft = Omit<CartItem, 'quantity' | 'maxQuantity' | 'surface' | 'catalogId'> & {
  maxQuantity?: number | null
  surface?: CartSurface
  catalogId?: string | null
}

function sameCheckout(current: CartItem, incoming: CartDraft) {
  const surface = incoming.surface || 'store'
  return current.surface === surface && (current.catalogId || null) === (incoming.catalogId || null)
}

export function addToCart(
  item: CartDraft,
  quantity = 1,
  key = STORE_CART_KEY,
): { items: CartItem[]; error?: string } {
  const current = readCart(key)
  if (current.length && !sameCheckout(current[0], item)) {
    return {
      items: current,
      error: 'Check out or clear the cart before adding gifts from another catalogue.',
    }
  }
  const maxQuantity = item.maxQuantity == null ? null : Math.max(1, Math.round(item.maxQuantity))
  const addQty = Math.max(1, Math.round(quantity) || 1)
  const existing = current.find((row) => row.id === item.id)
  if (existing && maxQuantity != null && existing.quantity + addQty > maxQuantity) {
    return {
      items: current,
      error: `Only ${maxQuantity} in stock.`,
    }
  }
  const nextQuantity = existing ? existing.quantity + addQty : addQty
  const next = existing
    ? current.map((row) => (row.id === existing.id ? { ...row, quantity: nextQuantity, maxQuantity } : row))
    : [
        ...current,
        {
          id: item.id,
          sku: item.sku,
          name: item.name,
          price: item.price,
          image_url: item.image_url,
          quantity: maxQuantity != null ? Math.min(nextQuantity, maxQuantity) : nextQuantity,
          maxQuantity,
          surface: item.surface || 'store',
          catalogId: item.catalogId || null,
        },
      ]
  writeCart(next, key)
  return { items: next }
}

export function updateCartQuantity(id: string, quantity: number, key = STORE_CART_KEY) {
  const current = readCart(key)
  const next =
    quantity <= 0
      ? current.filter((row) => row.id !== id)
      : current.map((row) => {
          if (row.id !== id) return row
          const capped = row.maxQuantity != null ? Math.min(quantity, row.maxQuantity) : quantity
          return { ...row, quantity: capped }
        })
  writeCart(next, key)
  return next
}

export function removeFromCart(id: string, key = STORE_CART_KEY) {
  const next = readCart(key).filter((row) => row.id !== id)
  writeCart(next, key)
  return next
}

export function clearCart(key = STORE_CART_KEY) {
  writeCart([], key)
}
