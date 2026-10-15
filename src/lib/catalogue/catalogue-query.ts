import { sanitiseCatalogueSearch, type PublicProduct } from '@/lib/catalogue/products'
import { STORE_OCCASIONS } from '@/lib/catalogue/storefront'
import { isUuid } from '@/lib/utils'

export type CatalogueSort = 'name' | 'newest' | 'price_low' | 'price_high'

export type CatalogueFilters = {
  q: string
  category: string
  brand: string
  occasion: string
  priceMin: number | null
  priceMax: number | null
  sort: CatalogueSort
}

export type CatalogueFilterPatch = {
  q?: string
  category?: string
  brand?: string
  occasion?: string
  priceMin?: number | null
  priceMax?: number | null
  sort?: CatalogueSort
}

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) || ''
}

export function priceBoundsOf(products: { price: number | null }[]) {
  const peak = Math.max(0, ...products.map((product) => product.price || 0))
  return {
    min: 0,
    max: Math.max(100, Math.ceil((peak || 100) / 100) * 100),
  }
}

export function readCatalogueFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): CatalogueFilters {
  const sortRaw = first(params?.sort)
  const sort: CatalogueSort =
    sortRaw === 'newest' || sortRaw === 'price_low' || sortRaw === 'price_high' ? sortRaw : 'name'
  const occasion = first(params?.occasion)
  const priceMinRaw = first(params?.priceMin)
  const priceMaxRaw = first(params?.priceMax)
  const priceMin = priceMinRaw === '' ? null : Number(priceMinRaw)
  const priceMax = priceMaxRaw === '' ? null : Number(priceMaxRaw)
  const category = first(params?.category)
  const brand = first(params?.brand)
  return {
    q: sanitiseCatalogueSearch(first(params?.q)),
    category: isUuid(category) ? category : '',
    brand: isUuid(brand) ? brand : '',
    occasion: STORE_OCCASIONS.some((item) => item.id === occasion) ? occasion : '',
    priceMin: priceMin != null && Number.isFinite(priceMin) ? priceMin : null,
    priceMax: priceMax != null && Number.isFinite(priceMax) ? priceMax : null,
    sort,
  }
}

export function resolvedPriceWindow(filters: CatalogueFilters, bounds: { min: number; max: number }) {
  const min = Math.max(bounds.min, filters.priceMin ?? bounds.min)
  const max = Math.min(bounds.max, filters.priceMax ?? bounds.max)
  return {
    min,
    max,
    active: min > bounds.min || max < bounds.max,
  }
}

export function applyCatalogueFilters(
  products: PublicProduct[],
  filters: CatalogueFilters,
  bounds: { min: number; max: number },
) {
  const window = resolvedPriceWindow(filters, bounds)
  let filtered = products
  if (filters.q) {
    const needle = filters.q.toLowerCase()
    filtered = filtered.filter(
      (product) =>
        product.name.toLowerCase().includes(needle) ||
        product.sku.toLowerCase().includes(needle) ||
        (product.description || '').toLowerCase().includes(needle) ||
        (product.category_name || '').toLowerCase().includes(needle) ||
        (product.brand_name || '').toLowerCase().includes(needle),
    )
  }
  if (filters.category) filtered = filtered.filter((product) => product.category_id === filters.category)
  if (filters.brand) filtered = filtered.filter((product) => product.brand_id === filters.brand)
  if (filters.occasion) filtered = filtered.filter((product) => product.occasion_tags.includes(filters.occasion))
  if (window.active) {
    filtered = filtered.filter((product) => {
      const price = product.price || 0
      return price >= window.min && price <= window.max
    })
  }
  if (filters.sort === 'price_low') filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0))
  else if (filters.sort === 'price_high') filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0))
  else if (filters.sort === 'newest') {
    filtered = [...filtered].sort(
      (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || a.name.localeCompare(b.name),
    )
  } else filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name))
  return filtered
}

export function catalogueFiltersActive(filters: CatalogueFilters, bounds: { min: number; max: number }) {
  return Boolean(
    filters.q ||
      filters.category ||
      filters.brand ||
      filters.occasion ||
      resolvedPriceWindow(filters, bounds).active ||
      filters.sort !== 'name',
  )
}

export function catalogueHref(
  basePath: string,
  filters: CatalogueFilters,
  bounds: { min: number; max: number },
  patch: CatalogueFilterPatch = {},
) {
  const next: CatalogueFilters = {
    q: patch.q !== undefined ? patch.q : filters.q,
    category: patch.category !== undefined ? patch.category : filters.category,
    brand: patch.brand !== undefined ? patch.brand : filters.brand,
    occasion: patch.occasion !== undefined ? patch.occasion : filters.occasion,
    priceMin: patch.priceMin !== undefined ? patch.priceMin : filters.priceMin,
    priceMax: patch.priceMax !== undefined ? patch.priceMax : filters.priceMax,
    sort: patch.sort !== undefined ? patch.sort : filters.sort,
  }
  const params = new URLSearchParams()
  if (next.q) params.set('q', next.q)
  if (next.category) params.set('category', next.category)
  if (next.brand) params.set('brand', next.brand)
  if (next.occasion) params.set('occasion', next.occasion)
  if (next.priceMin != null && next.priceMin > bounds.min) params.set('priceMin', String(next.priceMin))
  if (next.priceMax != null && next.priceMax < bounds.max) params.set('priceMax', String(next.priceMax))
  if (next.sort !== 'name') params.set('sort', next.sort)
  const qs = params.toString()
  return `${basePath}${qs ? `?${qs}` : ''}`
}
