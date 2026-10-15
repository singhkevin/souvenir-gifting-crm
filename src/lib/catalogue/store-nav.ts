import { slugify } from '@/lib/utils'

/** Six category icons kept in the store navbar. Labels are the public names. */
export const STORE_NAV_CATEGORIES = [
  { name: 'Welcome Kits', label: 'Welcome Kits', icon: 'package' },
  { name: 'Drinkware', label: 'Drinkware & Mugs', icon: 'coffee' },
  { name: 'Bottles', label: 'Bottles', icon: 'droplet' },
  { name: 'Desk & Stationery', label: 'Diaries & Notebooks', icon: 'book' },
  { name: 'Apparel', label: 'Apparel', icon: 'shirt' },
  { name: 'Watches', label: 'Watches', icon: 'watch' },
] as const

export type StoreNavIcon = (typeof STORE_NAV_CATEGORIES)[number]['icon']

const SEARCH_FALLBACK: Record<string, string> = {
  Bottles: 'bottle',
  Drinkware: 'drinkware',
  'Desk & Stationery': 'notebook',
  Apparel: 'apparel',
  Watches: 'watch',
  'Welcome Kits': 'welcome kit',
}

export function storeNavCategoryHref(categories: { name: string }[], name: string) {
  if (categories.some((category) => category.name === name)) {
    return `/categories/${slugify(name)}`
  }
  const query = SEARCH_FALLBACK[name] || name
  return `/catalogue?q=${encodeURIComponent(query)}`
}

export function brandSlugBase(name: string) {
  return slugify(name) || 'brand'
}

/** Stable public slug. A short id suffix splits two brands that slugify the same. */
export function brandPublicSlug(brand: { id: string; name: string }, brands: { id: string; name: string }[]) {
  const base = brandSlugBase(brand.name)
  const same = brands.filter((item) => brandSlugBase(item.name) === base)
  if (same.length <= 1) return base
  return `${base}-${brand.id.replace(/-/g, '').slice(0, 8)}`
}

export function brandByPublicSlug<T extends { id: string; name: string }>(slug: string, brands: T[]) {
  return brands.find((brand) => brandPublicSlug(brand, brands) === slug) || null
}

export function brandPath(brand: { id: string; name: string }, brands: { id: string; name: string }[]) {
  return `/brands/${brandPublicSlug(brand, brands)}`
}
