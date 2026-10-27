export const PRODUCT_SEARCH_LIMIT = 20
export const PRODUCT_SEARCH_MIN = 2

export type SearchableProduct = {
  id: string
  name: string
  sku: string | null
}

/**
 * Pattern for one column `.ilike()`. The value stays a parameter, so a SKU like
 * `NB.01` is not read as PostgREST filter syntax.
 * `%` and `_` are escaped so they match literally.
 */
export function ilikeContainsPattern(raw: string): string | null {
  const term = raw.trim()
  if (term.length < PRODUCT_SEARCH_MIN) return null
  const escaped = term.replace(/[\\%_]/g, (character) => `\\${character}`)
  return `%${escaped}%`
}

/** Name matches and SKU matches, deduped, capped so the picker never paints the catalogue. */
export function mergeProductHits<T extends SearchableProduct>(
  nameHits: T[],
  skuHits: T[],
  limit = PRODUCT_SEARCH_LIMIT,
): { products: T[]; truncated: boolean } {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const row of [...nameHits, ...skuHits]) {
    if (!row.id || seen.has(row.id)) continue
    seen.add(row.id)
    merged.push(row)
  }
  merged.sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (byName) return byName
    return String(a.sku || '').localeCompare(String(b.sku || ''), undefined, { sensitivity: 'base' })
  })
  return {
    products: merged.slice(0, limit),
    truncated: nameHits.length > limit || skuHits.length > limit || merged.length > limit,
  }
}
