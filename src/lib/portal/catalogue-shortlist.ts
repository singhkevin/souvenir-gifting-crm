export type CatalogueShortlistItem = {
  id: string
  sku: string
  name: string
  price?: number | null
  image_url?: string | null
  category_name?: string | null
}

export const CATALOGUE_SHORTLIST_KEY = 'giffter_shortlist'

export function readCatalogueShortlist(): CatalogueShortlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOGUE_SHORTLIST_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .filter((item) => item && typeof item === 'object' && (item.id || item.sku) && item.name)
      .map((item) => ({
        id: String(item.id || item.sku),
        sku: String(item.sku || item.id),
        name: String(item.name),
        price: item.price == null ? null : Number(item.price),
        image_url: item.image_url ? String(item.image_url) : null,
        category_name: item.category_name ? String(item.category_name) : null,
      }))
  } catch {
    return []
  }
}

export function writeCatalogueShortlist(items: CatalogueShortlistItem[]) {
  localStorage.setItem(CATALOGUE_SHORTLIST_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('giffter-shortlist-change'))
}

export function isCatalogueShortlisted(idOrSku: string) {
  const needle = String(idOrSku)
  return readCatalogueShortlist().some((item) => item.id === needle || item.sku === needle)
}

export function toggleCatalogueShortlist(item: CatalogueShortlistItem) {
  const current = readCatalogueShortlist()
  const exists = current.some((row) => row.id === item.id || row.sku === item.sku)
  const next = exists
    ? current.filter((row) => row.id !== item.id && row.sku !== item.sku)
    : [...current, item]
  writeCatalogueShortlist(next)
  return !exists
}
