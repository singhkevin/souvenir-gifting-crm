import type { CollectionDef, CollectionRule, CollectionSort, RuleCondition } from './types'

/** The product fields a collection rule can read. PublicProduct satisfies this. */
export type RuleProduct = {
  id: string
  name: string
  description: string | null
  price: number | null
  category_name: string | null
  occasion_tags: string[]
  created_at: string | null
}

function hasKeyword(text: string | null, keywords: string[]) {
  const value = (text || '').toLowerCase()
  return keywords.some((keyword) => {
    const word = keyword.trim().toLowerCase()
    return word.length > 0 && value.includes(word)
  })
}

export function matchCondition(product: RuleProduct, condition: RuleCondition): boolean {
  switch (condition.field) {
    case 'category':
      return condition.in.includes(product.category_name || '')
    case 'occasion':
      return condition.in.some((tag) => product.occasion_tags.includes(tag))
    case 'price': {
      const price = product.price || 0
      if (condition.gt != null && !(price > condition.gt)) return false
      if (condition.gte != null && !(price >= condition.gte)) return false
      if (condition.lt != null && !(price < condition.lt)) return false
      if (condition.lte != null && !(price <= condition.lte)) return false
      return true
    }
    case 'name':
      return hasKeyword(product.name, condition.keywords)
    case 'description':
      return hasKeyword(product.description, condition.keywords)
    default:
      return false
  }
}

/** A rule with no conditions matches nothing, so an empty draft never floods a page. */
export function matchRule(product: RuleProduct, rule: CollectionRule): boolean {
  const all = rule.all || []
  const any = rule.any || []
  if (!all.length && !any.length) return false
  if (!all.every((condition) => matchCondition(product, condition))) return false
  if (any.length && !any.some((condition) => matchCondition(product, condition))) return false
  return true
}

/** Stable sort; 'catalogue' keeps the incoming (name) order. */
export function sortProducts<T extends RuleProduct>(products: T[], sort: CollectionSort): T[] {
  if (sort === 'catalogue') return products
  const copy = [...products]
  if (sort === 'price_asc') copy.sort((a, b) => (a.price || 0) - (b.price || 0))
  if (sort === 'price_desc') copy.sort((a, b) => (b.price || 0) - (a.price || 0))
  if (sort === 'newest') copy.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return copy
}

/**
 * Products in a collection, in display order. `products` is already the channel's
 * visible list, so a hidden or inactive product never appears.
 * Manual: productIds in order. Rule: pinned productIds first, then rule matches.
 */
export function collectionProducts<T extends RuleProduct>(products: T[], collection: Pick<CollectionDef, 'source' | 'rule' | 'sort' | 'productIds'>): T[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  const picked: T[] = []
  const seen = new Set<string>()
  for (const id of collection.productIds || []) {
    const product = byId.get(id)
    if (!product || seen.has(id)) continue
    seen.add(id)
    picked.push(product)
  }
  if (collection.source === 'manual') return picked
  const matched = sortProducts(
    products.filter((product) => !seen.has(product.id) && matchRule(product, collection.rule)),
    collection.sort,
  )
  return [...picked, ...matched]
}
