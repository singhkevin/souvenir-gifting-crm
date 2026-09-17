export type CartItem = {
  id: string
  sku: string
  name: string
  price?: number | null
  image_url?: string | null
  quantity: number
}

export const CATALOGUE_CART_KEY = 'giffter_cart'

function normalize(item: unknown): CartItem | null {
  if (!item || typeof item !== 'object') return null
  const raw = item as Record<string, unknown>
  if (!raw.id && !raw.sku) return null
  if (!raw.name) return null
  const quantity = Math.max(1, Math.round(Number(raw.quantity) || 1))
  return {
    id: String(raw.id || raw.sku),
    sku: String(raw.sku || raw.id),
    name: String(raw.name),
    price: raw.price == null ? null : Number(raw.price),
    image_url: raw.image_url ? String(raw.image_url) : null,
    quantity,
  }
}

export function readCart(): CartItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOGUE_CART_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw.map(normalize).filter((item): item is CartItem => item !== null)
  } catch {
    return []
  }
}

export function writeCart(items: CartItem[]) {
  localStorage.setItem(CATALOGUE_CART_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('giffter-cart-change'))
}

/** Number of distinct products in the cart (not the sum of their quantities). */
export function getCartCount(items?: CartItem[]): number {
  return (items || readCart()).length
}

export function addToCart(item: Omit<CartItem, 'quantity'>, quantity = 1) {
  const current = readCart()
  const existing = current.find((row) => row.id === item.id || row.sku === item.sku)
  const next = existing
    ? current.map((row) =>
        row.id === existing.id ? { ...row, quantity: row.quantity + Math.max(1, quantity) } : row,
      )
    : [...current, { ...item, quantity: Math.max(1, quantity) }]
  writeCart(next)
  return next
}

export function updateCartQuantity(id: string, quantity: number) {
  const current = readCart()
  const next =
    quantity <= 0
      ? current.filter((row) => row.id !== id)
      : current.map((row) => (row.id === id ? { ...row, quantity } : row))
  writeCart(next)
  return next
}

export function removeFromCart(id: string) {
  const next = readCart().filter((row) => row.id !== id)
  writeCart(next)
  return next
}

export function clearCart() {
  writeCart([])
}
