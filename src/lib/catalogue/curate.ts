import type { PublicProduct } from '@/lib/catalogue/products'

const PRIORITY_CATEGORIES = [
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
] as const

/** Hero floats — one product per category, square studio shots only. */
const HERO_PREFERRED = [
  'Matte green insulated bottle',
  'Navy laptop daypack',
  'Wireless mechanical keyboard',
  'Forest hardcover notebook set',
  'Black softshell corporate jacket',
]

const STORY_PREFERRED = [
  'Black softshell corporate jacket',
  'Matte green insulated bottle',
  'Wireless mechanical keyboard',
  'Navy laptop daypack',
  'Leadership recognition hamper',
  'Starter welcome essentials kit',
]

const OCCASION_TILE_PREFERRED = [
  ['Starter welcome essentials kit', 'Hybrid work-from-home kit', 'New joiner onboarding hamper'],
  ['Leadership recognition hamper', 'Acacia serving tray', 'Self-care wellness box'],
  ['Silver cup trophy', 'Achievement medal with ribbon', 'Crystal recognition plaque'],
  ['Matte black travel tumbler', 'Wireless mechanical keyboard', 'Wood desk organiser tray'],
  ['Festive corporate hamper crate', 'Festival hamper crate', 'Kraft ribbon gift hamper'],
  ['Achievement medal with ribbon', 'Crystal recognition plaque', 'Silver cup trophy'],
] as const

/** Distinct preferred products per collection — no shared names across slugs. */
const COLLECTION_TILE_PREFERRED: Record<string, string[]> = {
  'executive-edit': ['Structured briefcase portfolio', 'Black softshell corporate jacket', 'Silver cup trophy'],
  'new-joiner-essentials': ['Starter welcome essentials kit', 'Hybrid work-from-home kit', 'New joiner onboarding hamper'],
  'client-appreciation': ['Leadership recognition hamper', 'Acacia serving tray', 'Self-care wellness box'],
  'festival-gifting': ['Festive corporate hamper crate', 'Festival hamper crate', 'Diwali sweets dry-fruit hamper'],
  'conference-and-events': ['Matte black travel tumbler', 'Wireless mechanical keyboard', 'Wood desk organiser tray'],
  'welcome-kits': ['Hybrid work-from-home kit', 'Premium induction gift box', 'Starter welcome essentials kit'],
}

const CATEGORY_TILE_PREFERRED: Record<string, string[]> = {
  Drinkware: ['Matte green insulated bottle', 'Matte black travel tumbler', 'Insulated coffee tumbler with lid'],
  'Bags & Travel': ['Navy laptop daypack', 'Charcoal weekender duffle', 'Quilted laptop messenger', 'Structured briefcase portfolio'],
  'Tech & Electronics': ['Wireless mechanical keyboard', '65W dual-port GaN charger', 'Wireless charging pad'],
  'Desk & Stationery': ['Wood desk organiser tray', 'Forest hardcover notebook set', 'Executive pen set'],
  Apparel: ['Black softshell corporate jacket', 'Forest green corporate polo', 'Navy corporate polo shirt'],
  'Hampers & Gift Sets': ['Leadership recognition hamper', 'Festive corporate hamper crate', 'Kraft ribbon gift hamper'],
  'Welcome Kits': ['Starter welcome essentials kit', 'Hybrid work-from-home kit', 'Premium induction gift box'],
  'Eco-Friendly Gifts': ['Bamboo wireless charger', 'Recycled notebook set'],
  Wellness: ['Essential oil wellness trio', 'Self-care wellness box', 'Rolled wellness yoga mat'],
  'Home & Lifestyle': ['Acacia serving tray', 'Linen throw blanket', 'Cotton waffle bathrobe'],
  'Awards & Recognition': ['Achievement medal with ribbon', 'Silver cup trophy', 'Crystal recognition plaque'],
}

const HOME_CATEGORY_TILES = [
  'Drinkware',
  'Bags & Travel',
  'Tech & Electronics',
  'Desk & Stationery',
  'Apparel',
  'Hampers & Gift Sets',
] as const

function isExclusiveGiftHamper(product: PublicProduct) {
  return /executive gift box|exclusive gift|gold ribbon executive/i.test(product.name)
}

/** Reject wrong/lifestyle/nested-frame shots that break homepage composition. */
function isMisalignedHomepageImage(product: PublicProduct) {
  const name = product.name
  if (
    /lanyard|badge holder|pashmina wrap|double-wall glass tumbler|hard-shell cabin trolley|leather work bag|gold laurel|executive gift box|graphite over-ear headphones|laptop backpack 20l|premium induction gift box/i.test(
      name,
    )
  ) {
    return true
  }
  if (/studio-home-/i.test(product.image_url || '')) return true
  if (/lifestyle|person|latte|hands holding|outdoor|hallway|office scene/i.test(product.description || '')) {
    return true
  }
  return false
}

function isWatch(product: PublicProduct) {
  return product.category_name === 'Watches' || /watch/i.test(product.name)
}

function hasImage(product: PublicProduct) {
  return Boolean(product.image_url?.trim())
}

function imageKey(product: PublicProduct) {
  return (product.image_url || '').split('?')[0].toLowerCase()
}

function scoreProduct(product: PublicProduct) {
  let score = product.price || 0
  if (hasImage(product)) score += 5000
  if (/square-/i.test(product.image_url || '')) score += 2500
  if (PRIORITY_CATEGORIES.includes(product.category_name as (typeof PRIORITY_CATEGORIES)[number])) score += 1200
  if (isWatch(product)) score -= 8000
  if (isMisalignedHomepageImage(product)) score -= 12000
  if (/lifestyle|person|outdoor|hallway|office scene/i.test(product.description || '')) score -= 500
  return score
}

function usableHomepagePool(products: PublicProduct[]) {
  return [...products]
    .filter(hasImage)
    .filter((product) => !isMisalignedHomepageImage(product))
    .sort((a, b) => scoreProduct(b) - scoreProduct(a))
}

function pickNamed(
  products: PublicProduct[],
  names: readonly string[],
  usedIds: Set<string>,
  usedImages: Set<string>,
) {
  for (const name of names) {
    const match = products.find((product) => product.name === name)
    if (!match || !hasImage(match) || isMisalignedHomepageImage(match)) continue
    if (usedIds.has(match.id) || usedImages.has(imageKey(match))) continue
    return match
  }
  return null
}

function claim(product: PublicProduct, usedIds: Set<string>, usedImages: Set<string>) {
  usedIds.add(product.id)
  usedImages.add(imageKey(product))
  return product
}

/**
 * Curate homepage rails: category diversity, prefer square studio gifts, no duplicate images.
 */
export function curateHomepageProducts(products: PublicProduct[], limit: number, maxWatches = 1) {
  const pool = usableHomepagePool(products)
  const selected: PublicProduct[] = []
  const used = new Set<string>()
  const usedImages = new Set<string>()
  const categoryCounts = new Map<string, number>()
  let watches = 0

  const tryAdd = (product: PublicProduct, maxPerCategory = 2) => {
    if (used.has(product.id) || usedImages.has(imageKey(product))) return false
    if (isWatch(product)) {
      if (watches >= maxWatches) return false
    } else {
      const cat = product.category_name || 'Other'
      if ((categoryCounts.get(cat) || 0) >= maxPerCategory) return false
    }
    selected.push(product)
    used.add(product.id)
    usedImages.add(imageKey(product))
    if (isWatch(product)) watches += 1
    else {
      const cat = product.category_name || 'Other'
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    }
    return true
  }

  const categoryPicks: PublicProduct[] = []
  for (const category of PRIORITY_CATEGORIES) {
    const preferred = CATEGORY_TILE_PREFERRED[category] || []
    const candidate =
      pickNamed(pool, preferred, used, usedImages) ||
      pool.find(
        (product) =>
          product.category_name === category &&
          !categoryPicks.some((pick) => pick.id === product.id) &&
          !usedImages.has(imageKey(product)),
      )
    if (candidate) categoryPicks.push(candidate)
  }
  categoryPicks.sort((a, b) => scoreProduct(b) - scoreProduct(a))
  for (const product of categoryPicks) {
    if (selected.length >= limit) break
    tryAdd(product, 1)
  }

  for (const product of pool) {
    if (selected.length >= limit) break
    tryAdd(product, 2)
  }

  if (selected.length < limit) {
    for (const product of pool) {
      if (selected.length >= limit) break
      if (used.has(product.id) || usedImages.has(imageKey(product))) continue
      if (isWatch(product) && watches >= maxWatches) continue
      selected.push(claim(product, used, usedImages))
      if (isWatch(product)) watches += 1
    }
  }

  return selected.slice(0, limit)
}

export function curateHeroProducts(products: PublicProduct[], limit = 4) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const selected: PublicProduct[] = []

  for (const name of HERO_PREFERRED) {
    if (selected.length >= limit) break
    const match = pickNamed(usableHomepagePool(products), [name], usedIds, usedImages)
    if (match) selected.push(claim(match, usedIds, usedImages))
  }

  if (selected.length < limit) {
    for (const product of curateHomepageProducts(products, limit * 2, 0)) {
      if (selected.length >= limit) break
      if (usedIds.has(product.id) || usedImages.has(imageKey(product))) continue
      selected.push(claim(product, usedIds, usedImages))
    }
  }

  return selected.slice(0, limit)
}

export function curateEditProducts(products: PublicProduct[], limit = 6) {
  return curateHomepageProducts(products, limit, 0)
}

export function curateTrendingProducts(products: PublicProduct[], limit = 10) {
  const recent = usableHomepagePool(products)
    .filter((product) => !isWatch(product))
    .filter((product) => !isExclusiveGiftHamper(product))
    .sort(
      (a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')) ||
        scoreProduct(b) - scoreProduct(a),
    )
  const selected: PublicProduct[] = []
  const used = new Set<string>()
  const usedImages = new Set<string>()
  const cats = new Map<string, number>()

  for (const product of recent) {
    if (selected.length >= limit) break
    if (usedImages.has(imageKey(product))) continue
    const cat = product.category_name || 'Other'
    if ((cats.get(cat) || 0) >= 2) continue
    selected.push(claim(product, used, usedImages))
    cats.set(cat, (cats.get(cat) || 0) + 1)
  }

  if (selected.length < limit) {
    for (const product of curateHomepageProducts(products, limit * 2, 0)) {
      if (selected.length >= limit) break
      if (used.has(product.id) || usedImages.has(imageKey(product))) continue
      selected.push(claim(product, used, usedImages))
    }
  }

  return selected.slice(0, limit)
}

export function curateFeaturedProducts(products: PublicProduct[], limit = 8) {
  return curateHomepageProducts(products, limit, 0)
}

export function curateMoreProducts(products: PublicProduct[], exclude: PublicProduct[], limit = 8) {
  const excluded = new Set(exclude.map((product) => product.id))
  const excludedImages = new Set(exclude.map(imageKey))
  return curateHomepageProducts(
    products.filter((product) => !excluded.has(product.id) && !excludedImages.has(imageKey(product))),
    limit,
    0,
  )
}

export function curateStoryProduct(products: PublicProduct[]) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const match = pickNamed(usableHomepagePool(products), STORY_PREFERRED, usedIds, usedImages)
  if (match) return match
  return curateHomepageProducts(products, 8, 0)[0] || null
}

export function homeCategoryTiles<T extends { name: string }>(categories: T[], limit = 6) {
  const byName = new Map(categories.map((category) => [category.name, category]))
  const ordered = HOME_CATEGORY_TILES.map((name) => byName.get(name)).filter(Boolean) as T[]
  if (ordered.length >= limit) return ordered.slice(0, limit)
  for (const category of categories) {
    if (ordered.some((item) => item.name === category.name)) continue
    if (category.name === 'Watches' || category.name === 'Other') continue
    ordered.push(category)
    if (ordered.length >= limit) break
  }
  return ordered.slice(0, limit)
}

export function pickCategorySample(products: PublicProduct[], categoryId: string, categoryName?: string) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const preferred = categoryName ? CATEGORY_TILE_PREFERRED[categoryName] || [] : []
  const inCategory = usableHomepagePool(products).filter((product) => product.category_id === categoryId)
  const named = pickNamed(inCategory, preferred, usedIds, usedImages)
  if (named) return named
  return inCategory[0] || products.find((product) => product.category_id === categoryId && hasImage(product)) || null
}

/** Pick unique category tile products with no repeated images across the grid. */
export function pickCategorySamples(
  products: PublicProduct[],
  categories: { id: string; name: string }[],
) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const samples = new Map<string, PublicProduct | null>()

  for (const category of categories) {
    const preferred = CATEGORY_TILE_PREFERRED[category.name] || []
    const inCategory = usableHomepagePool(products).filter((product) => product.category_id === category.id)
    const named = pickNamed(inCategory, preferred, usedIds, usedImages)
    const fallback = inCategory.find(
      (product) => !usedIds.has(product.id) && !usedImages.has(imageKey(product)),
    )
    const chosen = named || fallback || null
    if (chosen) claim(chosen, usedIds, usedImages)
    samples.set(category.id, chosen)
  }

  return samples
}

export function pickCollectionSample(
  products: PublicProduct[],
  slug: string,
  match: (product: PublicProduct) => boolean,
) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const pool = usableHomepagePool(products).filter(match)
  const preferred = COLLECTION_TILE_PREFERRED[slug] || []
  return (
    pickNamed(pool, preferred, usedIds, usedImages) ||
    pool[0] ||
    products.find((product) => match(product) && hasImage(product)) ||
    null
  )
}

/** Unique collection tile images — never reuse the same product/photo across cards. */
export function pickCollectionSamples(
  products: PublicProduct[],
  collections: { slug: string; match: (product: PublicProduct) => boolean }[],
) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const samples = new Map<string, PublicProduct | null>()

  for (const collection of collections) {
    const pool = usableHomepagePool(products).filter(collection.match)
    const preferred = COLLECTION_TILE_PREFERRED[collection.slug] || []
    const named = pickNamed(pool, preferred, usedIds, usedImages)
    const fallback = pool.find(
      (product) => !usedIds.has(product.id) && !usedImages.has(imageKey(product)),
    )
    const chosen = named || fallback || null
    if (chosen) claim(chosen, usedIds, usedImages)
    samples.set(collection.slug, chosen)
  }

  return samples
}

export function pickOccasionSample(products: PublicProduct[], index: number) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const preferred = OCCASION_TILE_PREFERRED[index % OCCASION_TILE_PREFERRED.length] || []
  return (
    pickNamed(usableHomepagePool(products), preferred, usedIds, usedImages) ||
    curateHomepageProducts(products, 24, 0)[index % 24] ||
    null
  )
}

/** Unique occasion tile images across the homepage grid. */
export function pickOccasionSamples(
  products: PublicProduct[],
  occasions: { slug: string }[],
) {
  const usedIds = new Set<string>()
  const usedImages = new Set<string>()
  const samples = new Map<string, PublicProduct | null>()
  const pool = usableHomepagePool(products)

  occasions.forEach((occasion, index) => {
    const preferred = OCCASION_TILE_PREFERRED[index % OCCASION_TILE_PREFERRED.length] || []
    const named = pickNamed(pool, preferred, usedIds, usedImages)
    const fallback = pool.find(
      (product) => !usedIds.has(product.id) && !usedImages.has(imageKey(product)),
    )
    const chosen = named || fallback || null
    if (chosen) claim(chosen, usedIds, usedImages)
    samples.set(occasion.slug, chosen)
  })

  return samples
}
