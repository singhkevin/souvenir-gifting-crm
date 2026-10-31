export const PICKER_PAGE_SIZE = 24
/** Compact requirement grid: about 8–10 cards per row, so one load should fill several rows. */
export const PICKER_DENSE_PAGE_SIZE = 60

export type PickerFilterProduct = {
  id: string
  name: string
  sku: string
  category: string | null
  price: number
}

export type PickerFilter = {
  query: string
  category: string
  minPrice: string
  maxPrice: string
}

function bound(value: string): number | null {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function filterPickerProducts<T extends PickerFilterProduct>(products: T[], filter: PickerFilter): T[] {
  const needle = filter.query.trim().toLowerCase()
  const min = bound(filter.minPrice)
  const max = bound(filter.maxPrice)
  return products.filter((product) => {
    if (filter.category && product.category !== filter.category) return false
    if (min != null && product.price < min) return false
    if (max != null && product.price > max) return false
    if (!needle) return true
    return product.name.toLowerCase().includes(needle) || product.sku.toLowerCase().includes(needle)
  })
}

export function slicePickerPage<T>(products: T[], visible: number): { items: T[]; remaining: number } {
  const count = Number.isFinite(visible) ? Math.max(0, Math.floor(visible)) : 0
  return {
    items: products.slice(0, count),
    remaining: Math.max(0, products.length - count),
  }
}

export function stockBadge(stockQty: number | null | undefined): { label: string; tone: 'in' | 'low' | 'out' } | null {
  if (stockQty == null || !Number.isFinite(stockQty)) return null
  if (stockQty <= 0) return { label: 'Out of stock', tone: 'out' }
  if (stockQty <= 5) return { label: `${stockQty} in stock`, tone: 'low' }
  return { label: `${stockQty} in stock`, tone: 'in' }
}
