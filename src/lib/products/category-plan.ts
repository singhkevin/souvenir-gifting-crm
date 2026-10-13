import { resolveCategoryName } from '@/lib/products/categories'

export type CategoryRef = { id: string; name: string }

export function collapseCategoryName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ')
}

export function canonicalCategoryLabel(raw: string) {
  return resolveCategoryName(collapseCategoryName(raw))
}

function lookupKeys(raw: string) {
  const collapsed = collapseCategoryName(raw)
  const keys = new Set<string>()
  if (!collapsed) return keys
  keys.add(collapsed.toLowerCase())
  const canonical = canonicalCategoryLabel(collapsed)
  if (canonical) keys.add(canonical.toLowerCase())
  return keys
}

/** Case-insensitive match, including PRODUCT_CATEGORY_ALIASES on either side. */
export function findCategory(rows: CategoryRef[], raw: string): CategoryRef | null {
  const wanted = lookupKeys(raw)
  if (wanted.size === 0) return null
  for (const row of rows) {
    const rowKeys = lookupKeys(row.name)
    for (const key of wanted) {
      if (rowKeys.has(key)) return row
    }
  }
  return null
}

/**
 * Names that still need a row, deduped case-insensitively after aliases.
 * The stored label is the canonical name (alias target, or the collapsed input).
 */
export function planMissingCategories(existing: CategoryRef[], requested: string[]) {
  const rows = existing.map((row) => ({ ...row }))
  const toCreate: string[] = []
  for (const raw of requested) {
    const label = canonicalCategoryLabel(raw)
    if (!label) continue
    if (findCategory(rows, label)) continue
    toCreate.push(label)
    rows.push({ id: `pending:${label.toLowerCase()}`, name: label })
  }
  return toCreate
}

export function assignCategoryId(rows: CategoryRef[], raw: string) {
  return findCategory(rows, raw)?.id ?? null
}

export type CategoryPreviewFailure = { row: number; sku: string; reason: string }

/** Same category matching the CSV import uses, plus the name/SKU/price errors that block a row. */
export function previewImportCategories(input: {
  rows: { row: number; sku: string; name: string; category: string; price: string }[]
  existing: CategoryRef[]
  createMissing: boolean
}) {
  const failures: CategoryPreviewFailure[] = []
  const requested: string[] = []
  for (const row of input.rows) {
    if (!row.name && !row.sku) continue
    if (!row.name || !row.sku) {
      failures.push({ row: row.row, sku: row.sku || '—', reason: 'Product name and SKU are required' })
      continue
    }
    const price = Number(row.price)
    if (!Number.isFinite(price) || price < 0) {
      failures.push({ row: row.row, sku: row.sku, reason: 'Price must be a number 0 or greater' })
      continue
    }
    if (!row.category) continue
    requested.push(row.category)
    if (!input.createMissing && !assignCategoryId(input.existing, row.category)) {
      failures.push({ row: row.row, sku: row.sku, reason: `Category not found: ${row.category}` })
    }
  }
  return {
    categories: input.createMissing ? planMissingCategories(input.existing, requested) : [],
    failures,
  }
}
