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

const HERO_PREFERRED = [
  'Premium insulated bottle',
  'Laptop backpack 20L',
  'Graphite over-ear headphones',
  'Matte black travel tumbler',
  'Forest hardcover notebook set',
  'Navy laptop daypack',
  'Starter welcome essentials kit',
  'Forest green corporate polo',
  'Silver coin keepsake',
  'Wood desk organiser tray',
  'Black softshell corporate jacket',
  'Charcoal weekender duffle',
]

const STORY_PREFERRED = [
  'Premium insulated bottle',
  'Graphite over-ear headphones',
  'Laptop backpack 20L',
  'Black softshell corporate jacket',
  'Premium induction gift box',
  'Leadership recognition hamper',
]

const OCCASION_TILE_PREFERRED = [
  ['Premium induction gift box', 'Starter welcome essentials kit', 'Hybrid work-from-home kit'],
  ['Leadership recognition hamper', 'Kraft ribbon gift hamper', 'Self-care wellness box'],
  ['Silver cup trophy', 'Achievement medal with ribbon', 'Crystal recognition plaque'],
  ['Premium insulated bottle', 'Graphite over-ear headphones', 'Matte black travel tumbler'],
  ['Festive corporate hamper crate', 'Kraft ribbon gift hamper', 'Leadership recognition hamper'],
  ['Achievement medal with ribbon', 'Silver cup trophy', 'Crystal recognition plaque'],
] as const

const COLLECTION_TILE_PREFERRED: Record<string, string[]> = {
  'executive-edit': ['Black softshell corporate jacket', 'Structured briefcase portfolio', 'Silver cup trophy'],
  'new-joiner-essentials': [
    'Premium induction gift box',
    'Starter welcome essentials kit',
    'Hybrid work-from-home kit',
    'New joiner onboarding hamper',
  ],
  'client-appreciation': ['Leadership recognition hamper', 'Kraft ribbon gift hamper', 'Acacia serving tray'],
  'festival-gifting': ['Festive corporate hamper crate', 'Festival hamper crate', 'Kraft ribbon gift hamper'],
  'conference-and-events': ['Premium insulated bottle', 'Graphite over-ear headphones', 'Wood desk organiser tray'],
  'welcome-kits': ['Premium induction gift box', 'Starter welcome essentials kit', 'Hybrid work-from-home kit'],
}

function isExclusiveGiftHamper(product: PublicProduct) {
  return /executive gift box|exclusive gift|gold ribbon executive/i.test(product.name)
}

/** Products whose current photos crop poorly in homepage tiles/cards. */
function isMisalignedHomepageImage(product: PublicProduct) {
  const name = product.name
  if (
    /lanyard|badge holder|double-wall glass tumbler|hard-shell cabin trolley|leather work bag|gold laurel|executive gift box/i.test(
      name,
    )
  ) {
    return true
  }
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

function scoreProduct(product: PublicProduct) {
  let score = product.price || 0
  if (hasImage(product)) score += 5000
  if (PRIORITY_CATEGORIES.includes(product.category_name as (typeof PRIORITY_CATEGORIES)[number])) score += 1200
  if (isWatch(product)) score -= 8000
  if (isMisalignedHomepageImage(product)) score -= 12000
  if (/lifestyle|person|outdoor|hallway|office scene/i.test(product.description || '')) score -= 500
  return score
}

/**
 * Curate homepage rails: category diversity, prefer imaged premium gifts, limit watches.
 */
export function curateHomepageProducts(products: PublicProduct[], limit: number, maxWatches = 1) {
  const pool = [...products]
    .filter(hasImage)
    .filter((product) => !isMisalignedHomepageImage(product))
    .sort((a, b) => scoreProduct(b) - scoreProduct(a))
  const selected: PublicProduct[] = []
  const used = new Set<string>()
  const categoryCounts = new Map<string, number>()
  let watches = 0

  const tryAdd = (product: PublicProduct, maxPerCategory = 2) => {
    if (used.has(product.id)) return false
    if (isWatch(product)) {
      if (watches >= maxWatches) return false
    } else {
      const cat = product.category_name || 'Other'
      if ((categoryCounts.get(cat) || 0) >= maxPerCategory) return false
    }
    selected.push(product)
    used.add(product.id)
    if (isWatch(product)) watches += 1
    else {
      const cat = product.category_name || 'Other'
      categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
    }
    return true
  }

  // First pass: best imaged product from each priority category
  const categoryPicks: PublicProduct[] = []
  for (const category of PRIORITY_CATEGORIES) {
    const candidate = pool.find(
      (product) => product.category_name === category && !categoryPicks.some((pick) => pick.id === product.id),
    )
    if (candidate) categoryPicks.push(candidate)
  }
  categoryPicks.sort((a, b) => scoreProduct(b) - scoreProduct(a))
  for (const product of categoryPicks) {
    if (selected.length >= limit) break
    tryAdd(product, 1)
  }

  // Second pass: fill remaining with diversity
  for (const product of pool) {
    if (selected.length >= limit) break
    tryAdd(product, 2)
  }

  // If still short, relax category caps (still limit watches)
  if (selected.length < limit) {
    for (const product of pool) {
      if (selected.length >= limit) break
      if (used.has(product.id)) continue
      if (isWatch(product) && watches >= maxWatches) continue
      selected.push(product)
      used.add(product.id)
      if (isWatch(product)) watches += 1
    }
  }

  return selected.slice(0, limit)
}

export function curateHeroProducts(products: PublicProduct[], limit = 5) {
  const preferred = HERO_PREFERRED.map((name) => products.find((product) => product.name === name)).filter(
    Boolean,
  ) as PublicProduct[]
  const curated = preferred.filter(hasImage).filter((product) => !isWatch(product))
  if (curated.length >= Math.min(4, limit)) return curated.slice(0, limit)
  const fill = curateHomepageProducts(products, limit, 0)
  const merged = [...curated]
  for (const product of fill) {
    if (merged.length >= limit) break
    if (!merged.some((item) => item.id === product.id)) merged.push(product)
  }
  return merged.slice(0, limit)
}

export function curateEditProducts(products: PublicProduct[], limit = 6) {
  return curateHomepageProducts(products, limit, 1)
}

export function curateTrendingProducts(products: PublicProduct[], limit = 10) {
  // Prefer recently created non-watch gifts, then diversify
  const recent = [...products]
    .filter(hasImage)
    .filter((product) => !isWatch(product))
    .filter((product) => !isExclusiveGiftHamper(product))
    .filter((product) => !isMisalignedHomepageImage(product))
    .sort(
      (a, b) =>
        String(b.created_at || '').localeCompare(String(a.created_at || '')) ||
        scoreProduct(b) - scoreProduct(a),
    )
  const selected: PublicProduct[] = []
  const used = new Set<string>()
  const cats = new Map<string, number>()

  for (const product of recent) {
    if (selected.length >= limit) break
    const cat = product.category_name || 'Other'
    if ((cats.get(cat) || 0) >= 2) continue
    selected.push(product)
    used.add(product.id)
    cats.set(cat, (cats.get(cat) || 0) + 1)
  }

  if (selected.length < limit) {
    for (const product of curateHomepageProducts(products, limit * 2, 0)) {
      if (selected.length >= limit) break
      if (used.has(product.id)) continue
      selected.push(product)
      used.add(product.id)
    }
  }

  return selected.slice(0, limit)
}

export function curateFeaturedProducts(products: PublicProduct[], limit = 8) {
  return curateHomepageProducts(products, limit, 1)
}

export function curateMoreProducts(products: PublicProduct[], exclude: PublicProduct[], limit = 8) {
  const excluded = new Set(exclude.map((product) => product.id))
  return curateHomepageProducts(
    products.filter((product) => !excluded.has(product.id)),
    limit,
    0,
  )
}

export function curateStoryProduct(products: PublicProduct[]) {
  for (const name of STORY_PREFERRED) {
    const match = products.find(
      (product) =>
        product.name === name &&
        hasImage(product) &&
        !isWatch(product) &&
        !isExclusiveGiftHamper(product) &&
        !isMisalignedHomepageImage(product),
    )
    if (match) return match
  }
  return (
    curateHomepageProducts(products, 8, 0).find(
      (product) => !isExclusiveGiftHamper(product) && !isMisalignedHomepageImage(product),
    ) || null
  )
}

const HOME_CATEGORY_TILES = [
  'Drinkware',
  'Bags & Travel',
  'Tech & Electronics',
  'Desk & Stationery',
  'Apparel',
  'Hampers & Gift Sets',
] as const

/** Prefer full-bleed studio shots that read cleanly in 4:5 category tiles. */
const CATEGORY_TILE_PREFERRED: Record<string, string[]> = {
  Drinkware: [
    'Matte black travel tumbler',
    'Matte green insulated bottle',
    'Premium insulated bottle',
    'Insulated coffee tumbler with lid',
  ],
  'Bags & Travel': [
    'Laptop backpack 20L',
    'Navy laptop daypack',
    'Charcoal weekender duffle',
    'Quilted laptop messenger',
  ],
  'Tech & Electronics': [
    'Graphite over-ear headphones',
    'Wireless mechanical keyboard',
    '65W dual-port GaN charger',
    'Wireless charging pad',
  ],
  'Desk & Stationery': [
    'Wood desk organiser tray',
    'Forest hardcover notebook set',
    'Executive pen set',
    'Hardcover planner A5',
  ],
  Apparel: [
    'Black softshell corporate jacket',
    'Forest green corporate polo',
    'Navy corporate polo shirt',
    'Zip-through hoodie',
  ],
  'Hampers & Gift Sets': [
    'Leadership recognition hamper',
    'Festive corporate hamper crate',
    'Kraft ribbon gift hamper',
    'Festival hamper crate',
  ],
  'Welcome Kits': [
    'Premium induction gift box',
    'Starter welcome essentials kit',
    'Hybrid work-from-home kit',
  ],
  'Eco-Friendly Gifts': ['Bamboo wireless charger', 'Recycled notebook set'],
  Wellness: ['Essential oil wellness trio', 'Self-care wellness box', 'Pashmina wrap'],
  'Home & Lifestyle': ['Acacia serving tray', 'Linen throw blanket', 'Cotton waffle bathrobe'],
  'Awards & Recognition': ['Achievement medal with ribbon', 'Silver cup trophy', 'Crystal recognition plaque'],
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
  const inCategory = products.filter(
    (product) =>
      product.category_id === categoryId && hasImage(product) && !isMisalignedHomepageImage(product),
  )
  if (!inCategory.length) {
    return (
      products.find((product) => product.category_id === categoryId && hasImage(product)) || null
    )
  }

  const preferred = categoryName ? CATEGORY_TILE_PREFERRED[categoryName] || [] : []
  for (const name of preferred) {
    const match = inCategory.find((product) => product.name === name)
    if (match) return match
  }

  return [...inCategory].sort((a, b) => scoreProduct(b) - scoreProduct(a))[0] || inCategory[0]
}

export function pickCollectionSample(
  products: PublicProduct[],
  slug: string,
  match: (product: PublicProduct) => boolean,
) {
  const pool = products.filter(
    (product) => match(product) && hasImage(product) && !isMisalignedHomepageImage(product),
  )
  const preferred = COLLECTION_TILE_PREFERRED[slug] || []
  for (const name of preferred) {
    const matchPreferred = pool.find((product) => product.name === name)
    if (matchPreferred) return matchPreferred
  }
  return [...pool].sort((a, b) => scoreProduct(b) - scoreProduct(a))[0] || products.find(match) || null
}

export function pickOccasionSample(products: PublicProduct[], index: number) {
  const preferred = OCCASION_TILE_PREFERRED[index % OCCASION_TILE_PREFERRED.length] || []
  for (const name of preferred) {
    const match = products.find(
      (product) => product.name === name && hasImage(product) && !isMisalignedHomepageImage(product),
    )
    if (match) return match
  }
  const curated = curateHomepageProducts(
    products.filter((product) => !isExclusiveGiftHamper(product)),
    24,
    0,
  )
  return curated[index % curated.length] || products.find(hasImage) || null
}
