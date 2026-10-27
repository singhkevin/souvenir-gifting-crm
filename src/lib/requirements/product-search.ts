/**
 * The requirement product picker used to load every active product with no limit.
 * PostgREST returns at most POSTGREST_MAX_ROWS and drops the rest, and the page
 * mounted that page in one select, which locked the browser on a large catalogue.
 * Search asks for a small page and matches name or SKU in the database.
 */
export const POSTGREST_MAX_ROWS = 1000
export const REQUIREMENT_PICKER_LIMIT = 20

/** What an unlimited `.select().order('name')` actually returned. */
export function firstPostgrestPage<T>(rows: T[], pageSize = POSTGREST_MAX_ROWS): T[] {
  return rows.slice(0, pageSize)
}

/** Strip characters that break a PostgREST `or` filter or act as LIKE wildcards. */
export function productSearchTokens(raw: string): string[] {
  return raw
    .replace(/[,()*\\%_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 6)
}

export function requirementProductQueryPlan(raw: string) {
  const tokens = productSearchTokens(raw)
  return {
    limit: REQUIREMENT_PICKER_LIMIT,
    fetch: REQUIREMENT_PICKER_LIMIT + 1,
    clauses:
      tokens.length === 0
        ? null
        : tokens.map((token) => `name.ilike.%${token}%,sku.ilike.%${token}%`),
  }
}

/** Same token rules as the database filter, for tests and for explaining a miss. */
export function productMatchesSearch(
  product: { name: string; sku: string | null },
  raw: string,
): boolean {
  const tokens = productSearchTokens(raw).map((token) => token.toLowerCase())
  if (tokens.length === 0) return true
  const hay = `${product.name} ${product.sku || ''}`.toLowerCase()
  return tokens.every((token) => hay.includes(token))
}

export function capPickerRows<T>(rows: T[], limit = REQUIREMENT_PICKER_LIMIT): { rows: T[]; truncated: boolean } {
  if (rows.length > limit) return { rows: rows.slice(0, limit), truncated: true }
  return { rows, truncated: false }
}

export function pickerStatus(input: {
  searching: boolean
  query: string
  count: number
  truncated: boolean
  limit?: number
}): string {
  if (input.searching) return 'Searching…'
  const limit = input.limit ?? REQUIREMENT_PICKER_LIMIT
  const needle = input.query.trim()
  if (input.count === 0) {
    return needle ? 'No products match that search.' : 'No active products to add.'
  }
  if (!input.truncated) return input.count === 1 ? '1 product' : `${input.count} products`
  if (needle) return `Showing the first ${limit} matches · add another word to narrow the list`
  return `Showing the first ${limit} · search by name or SKU for the rest`
}
