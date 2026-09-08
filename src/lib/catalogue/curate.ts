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

/** Bump to reshuffle homepage rails when preferred lists rotate. */
const HOME_CURATION_SEED = 7

/** Hero floats — mixed categories, full-bleed studio products. */
const HERO_PREFERRED = [
  'Chocolate truffle tower',
  'Acrylic pillar award',
  'Bamboo-lid glass bottle',
  'Slim graphite power bank',
  'Oxford button-down shirt',
]

/** Featured story — one hero visual only (do not reuse elsewhere on homepage). */
const STORY_PREFERRED = [
  'Spa bath ritual set',
  'Tea tasting gift crate',
  'Sparkling grape cheese box',
  'Tech desk tidy gift set',
]

const OCCASION_TILE_PREFERRED = [
  ['Premium induction gift box', 'Desk starter essentials kit', 'Welcome journal pen duo'],
  ['Chocolate truffle tower', 'Herbal wellness tea set', 'Nuts and honey jar set'],
  ['Acrylic pillar award', 'Acrylic star award', 'Walnut perpetual plaque'],
  ['Brushed steel vacuum flask', 'Aluminium laptop stand', 'Executive pen set'],
  ['Festive corporate hamper crate', 'Kraft ribbon gift hamper', 'Diwali sweets dry-fruit hamper'],
  ['Bamboo eco plaque', 'Slate engraving plaque', 'Brass desk medallion'],
] as const

/** Distinct preferred products per collection — no shared names across slugs. */
const COLLECTION_TILE_PREFERRED: Record<string, string[]> = {
  'executive-edit': ['Softshell bodywarmer', 'Quilted sleeveless gilet', 'Crystal recognition trophy'],
  'new-joiner-essentials': ['Branded mug welcome set', 'New-hire stationery bundle', 'Onboarding planner kit'],
  'client-appreciation': ['Chocolate truffle tower', 'Spa bath ritual set', 'Herbal wellness tea set'],
  'festival-gifting': ['Festive corporate hamper crate', 'Nuts and honey jar set', 'Tea tasting gift crate'],
  'conference-and-events': ['Brushed steel vacuum flask', 'Compact nylon sling bag', 'Bluetooth tracker tag set'],
  'welcome-kits': ['Soft-landing comfort kit', 'Team thermos welcome duo', 'Culture card welcome folio'],
}

const CATEGORY_TILE_PREFERRED: Record<string, string[]> = {
  Drinkware: ['Bamboo-lid glass bottle', 'Brushed steel vacuum flask', 'Ceramic travel mug with sleeve'],
  'Bags & Travel': [
    'Compact nylon sling bag',
    'Foldable packable backpack',
    'Expandable toiletry kit',
    'Crossbody tablet bag',
  ],
  'Tech & Electronics': ['Slim graphite power bank', 'Aluminium laptop stand', 'USB LED desk lamp'],
  'Desk & Stationery': ['Executive pen set', 'Marble pen cup', 'Softcover dotted journal'],
  Apparel: ['Oxford button-down shirt', 'Performance dri-fit polo', 'Quilted sleeveless gilet'],
  'Hampers & Gift Sets': [
    'Chocolate truffle tower',
    'Spa bath ritual set',
    'Tea tasting gift crate',
    'Tech desk tidy gift set',
  ],
  'Welcome Kits': ['Premium induction gift box', 'Desk starter essentials kit', 'Welcome journal pen duo'],
  'Eco-Friendly Gifts': ['Bamboo coffee tumbler', 'Seed paper notebook set', 'Wheat straw lunch box'],
  Wellness: ['Matte ceramic wellness candle', 'Aromatherapy roller set', 'Eye mask sleep kit'],
  'Home & Lifestyle': ['Bamboo cheese board', 'Reed diffuser set', 'Marble coaster quartet'],
  'Awards & Recognition': ['Acrylic pillar award', 'Acrylic star award', 'Walnut perpetual plaque'],
}

/** Demote the previous homepage set so rails fully rotate. */
const PREVIOUS_HOME_FEATURED = [
  'Appreciation thank-you box',
  'Breakfast brunch basket',
  'Olive oil vinegar gift crate',
  'Wireless mechanical keyboard',
  'Navy laptop daypack',
  'Festive dry fruit wooden tray',
  'Coffee connoisseur box',
  'Desk essentials starter kit',
  'Matte black travel tumbler',
  'Insulated coffee tumbler with lid',
  'Frosted acrylic tumbler',
  'Charcoal weekender duffle',
  'Quilted laptop messenger',
  'Structured beige tote',
  'Bamboo wireless charger pad',
  'Wireless charging pad',
  'Wood desk organiser tray',
  'Forest hardcover notebook set',
  'Sticky notes desk set',
  'Forest green corporate polo',
  'Navy corporate polo shirt',
  'Black softshell corporate jacket',
  'Starter welcome essentials kit',
  'Office caddy welcome set',
  'Induction gift crate',
  'Essential oil wellness trio',
  'Calm hour gift set',
  'Rolled wellness yoga mat',
  'Acacia serving tray',
  'Linen throw blanket',
  'Cotton waffle bathrobe',
  'Marble base trophy',
  'Glass flame award',
  'Crystal cube award',
  'Structured briefcase portfolio',
  'First-day essentials pouch',
  'Diwali sweets dry-fruit hamper',
  'Festival hamper crate',
  'Spiral A5 daily planner',
  'Executive onboarding folio',
  'New joiner onboarding hamper',
  'Crystal diamond award',
  'Glass medallion award',
  'Metal tower trophy',
  'Leadership recognition hamper',
  'Kraft sustainable wrap kit',
]

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
    /lanyard|badge holder|pashmina wrap|double-wall glass tumbler|hard-shell cabin trolley|leather work bag|gold laurel|executive gift box|graphite over-ear headphones|laptop backpack 20l|matte green insulated bottle|hybrid work-from-home kit|hardcover planner|bamboo desk set|recycled rpet notebook|ceramic mug 350ml|northsteel|wireless mouse|passport organiser|cottonline|ceramic aroma diffuser/i.test(
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
  // Full-bleed square assets (like appreciation / brunch reference) rank highest
  if (/square-/i.test(product.image_url || '')) score += 2800
  if (/\/site\/home-/i.test(product.image_url || '')) score += 2200
  if (PRIORITY_CATEGORIES.includes(product.category_name as (typeof PRIORITY_CATEGORIES)[number])) score += 1200
  if (isWatch(product)) score -= 8000
  if (isMisalignedHomepageImage(product)) score -= 12000
  if (/studio-pack-/i.test(product.image_url || '')) score += 1600
  if (/\/catalogue-fill\//i.test(product.image_url || '')) score -= 4000
  if (/lifestyle|person|outdoor|hallway|office scene/i.test(product.description || '')) score -= 500
  if (PREVIOUS_HOME_FEATURED.includes(product.name)) score -= 3500
  // Mild rotation so homepage regenerates with a fresh mix
  score += (product.name.charCodeAt(0) * 31 + product.name.length * 19 + HOME_CURATION_SEED * 97) % 520
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

type UsageSets = { usedIds: Set<string>; usedImages: Set<string> }

function freshUsage(): UsageSets {
  return { usedIds: new Set<string>(), usedImages: new Set<string>() }
}

/**
 * Curate homepage rails: category diversity, prefer square studio gifts, no duplicate images.
 */
export function curateHomepageProducts(
  products: PublicProduct[],
  limit: number,
  maxWatches = 1,
  usage: UsageSets = freshUsage(),
) {
  const pool = usableHomepagePool(products)
  const selected: PublicProduct[] = []
  const { usedIds: used, usedImages } = usage
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

export function curateHeroProducts(
  products: PublicProduct[],
  limit = 4,
  usage: UsageSets = freshUsage(),
) {
  const { usedIds, usedImages } = usage
  const selected: PublicProduct[] = []

  for (const name of HERO_PREFERRED) {
    if (selected.length >= limit) break
    const match = pickNamed(usableHomepagePool(products), [name], usedIds, usedImages)
    if (match) selected.push(claim(match, usedIds, usedImages))
  }

  if (selected.length < limit) {
    for (const product of usableHomepagePool(products)) {
      if (selected.length >= limit) break
      if (usedIds.has(product.id) || usedImages.has(imageKey(product))) continue
      selected.push(claim(product, usedIds, usedImages))
    }
  }

  return selected.slice(0, limit)
}

export function curateEditProducts(products: PublicProduct[], limit = 6, usage?: UsageSets) {
  return curateHomepageProducts(products, limit, 0, usage)
}

export function curateTrendingProducts(
  products: PublicProduct[],
  limit = 10,
  usage: UsageSets = freshUsage(),
) {
  const recent = usableHomepagePool(products)
    .filter((product) => !isWatch(product))
    .filter((product) => !isExclusiveGiftHamper(product))
    .sort(
      (a, b) =>
        scoreProduct(b) - scoreProduct(a) ||
        String(b.created_at || '').localeCompare(String(a.created_at || '')),
    )
  const selected: PublicProduct[] = []
  const { usedIds: used, usedImages } = usage
  const cats = new Map<string, number>()

  for (const product of recent) {
    if (selected.length >= limit) break
    if (used.has(product.id) || usedImages.has(imageKey(product))) continue
    const cat = product.category_name || 'Other'
    if ((cats.get(cat) || 0) >= 2) continue
    selected.push(claim(product, used, usedImages))
    cats.set(cat, (cats.get(cat) || 0) + 1)
  }

  if (selected.length < limit) {
    for (const product of usableHomepagePool(products)) {
      if (selected.length >= limit) break
      if (used.has(product.id) || usedImages.has(imageKey(product))) continue
      selected.push(claim(product, used, usedImages))
    }
  }

  return selected.slice(0, limit)
}

export function curateFeaturedProducts(products: PublicProduct[], limit = 8, usage?: UsageSets) {
  return curateHomepageProducts(products, limit, 0, usage)
}

export function curateMoreProducts(
  products: PublicProduct[],
  exclude: PublicProduct[],
  limit = 8,
  usage: UsageSets = freshUsage(),
) {
  for (const product of exclude) claim(product, usage.usedIds, usage.usedImages)
  return curateHomepageProducts(products, limit, 0, usage)
}

export function curateStoryProduct(products: PublicProduct[], usage: UsageSets = freshUsage()) {
  const match = pickNamed(usableHomepagePool(products), STORY_PREFERRED, usage.usedIds, usage.usedImages)
  if (match) return claim(match, usage.usedIds, usage.usedImages)
  const fallback = usableHomepagePool(products).find(
    (product) => !usage.usedIds.has(product.id) && !usage.usedImages.has(imageKey(product)),
  )
  return fallback ? claim(fallback, usage.usedIds, usage.usedImages) : null
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
  usage: UsageSets = freshUsage(),
) {
  const { usedIds, usedImages } = usage
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
  usage: UsageSets = freshUsage(),
) {
  const { usedIds, usedImages } = usage
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
  usage: UsageSets = freshUsage(),
) {
  const { usedIds, usedImages } = usage
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

/**
 * Single homepage pass: every visible tile/rail uses a unique product image.
 * Order reserves the most important surfaces first (story → hero → categories → collections → occasions → rails).
 */
export function curatePublicHome(
  products: PublicProduct[],
  categories: { id: string; name: string }[],
  collections: { slug: string; match: (product: PublicProduct) => boolean }[],
  occasions: { slug: string }[],
) {
  const usage = freshUsage()

  const story = curateStoryProduct(products, usage)
  const heroProducts = curateHeroProducts(products, 4, usage)
  const categorySamples = pickCategorySamples(products, categories, usage)
  const collectionSamples = pickCollectionSamples(products, collections, usage)
  const occasionSamples = pickOccasionSamples(products, occasions, usage)
  const trending = curateTrendingProducts(products, 10, usage)
  const edit = curateEditProducts(products, 6, usage)
  const featured = curateFeaturedProducts(products, 8, usage)
  const more = curateMoreProducts(products, [], 8, usage)

  return {
    story,
    heroProducts,
    categorySamples,
    collectionSamples,
    occasionSamples,
    trending,
    edit,
    featured,
    more,
  }
}
