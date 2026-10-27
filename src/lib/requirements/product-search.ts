/**
 * The requirement products tab used to render every active product in one
 * `<select>` / mobile sheet. PostgREST stops an unlimited read at this cap,
 * so later names never appeared, and opening the control locked the tab.
 */
export const CATALOGUE_ROW_CAP = 1000

/** Past this many options the products dropdown locks the tab. The picker stays under it. */
export const SELECT_LOCKUP_AT = 200

export const PICKER_RESULT_LIMIT = 20

export function dropdownLocksUp(optionCount: number) {
  return optionCount >= SELECT_LOCKUP_AT
}

/** Characters that break a PostgREST `or` filter or act as wildcards. */
const UNSAFE_SEARCH = /[%_,()*\\"'']/g

export function sanitizeProductSearch(raw: string): string {
  return raw.replace(UNSAFE_SEARCH, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

/** Quoted `or` filter, or null when the query is empty after sanitizing. */
export function productSearchOrFilter(raw: string): string | null {
  const safe = sanitizeProductSearch(raw)
  if (!safe) return null
  const pattern = `"%${safe}%"`
  return `name.ilike.${pattern},sku.ilike.${pattern}`
}

export function productMatchesQuery(
  product: { name: string; sku: string | null },
  query: string,
): boolean {
  const needle = sanitizeProductSearch(query).toLowerCase()
  if (!needle) return true
  return product.name.toLowerCase().includes(needle) || (product.sku || '').toLowerCase().includes(needle)
}

/** What the old dropdown kept: the first `cap` names. Everything else was missing. */
export function namesKeptByRowCap<T extends { name: string }>(rows: T[], cap = CATALOGUE_ROW_CAP): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, 'en')).slice(0, cap)
}
