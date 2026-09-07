/** Display order for the corporate gifting category taxonomy. */
export const PRODUCT_CATEGORY_ORDER = [
  'Drinkware',
  'Bags & Travel',
  'Tech & Electronics',
  'Desk & Stationery',
  'Apparel',
  'Hampers & Gift Sets',
  'Welcome Kits',
  'Eco-Friendly Gifts',
  'Wellness',
  'Home & Lifestyle',
  'Awards & Recognition',
  'Other',
] as const

/** Older category labels that still resolve after the taxonomy rename. */
export const PRODUCT_CATEGORY_ALIASES: Record<string, string> = {
  bags: 'Bags & Travel',
  'tech accessories': 'Tech & Electronics',
  stationery: 'Desk & Stationery',
  'welcome kits': 'Welcome Kits',
}

export function sortProductCategories<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ai = PRODUCT_CATEGORY_ORDER.indexOf(a.name as (typeof PRODUCT_CATEGORY_ORDER)[number])
    const bi = PRODUCT_CATEGORY_ORDER.indexOf(b.name as (typeof PRODUCT_CATEGORY_ORDER)[number])
    const ao = ai === -1 ? PRODUCT_CATEGORY_ORDER.length + 1 : ai
    const bo = bi === -1 ? PRODUCT_CATEGORY_ORDER.length + 1 : bi
    if (ao !== bo) return ao - bo
    return a.name.localeCompare(b.name)
  })
}

export function resolveCategoryName(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed
  return PRODUCT_CATEGORY_ALIASES[trimmed.toLowerCase()] || trimmed
}
