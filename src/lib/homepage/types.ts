/**
 * Editable retail homepage and collections.
 *
 * Everything here is plain data so it can live in the database (draft and published
 * jsonb) or in code (DEFAULT_HOMEPAGE, DEFAULT_COLLECTIONS) when the tables are absent.
 */

/** Calendar window. Dates are India dates (YYYY-MM-DD, Asia/Kolkata). */
export type Schedule = {
  startsOn?: string | null
  endsOn?: string | null
  /** Ignore the year and repeat every year on the same month-day window. */
  repeatYearly?: boolean
}

/** A product matches when it passes every `all` condition and at least one `any` condition. */
export type RuleCondition =
  | { field: 'category'; in: string[] }
  | { field: 'occasion'; in: string[] }
  /** Store sell price. A missing price counts as 0. */
  | { field: 'price'; gt?: number; gte?: number; lt?: number; lte?: number }
  /** Case-insensitive substring match on any keyword. */
  | { field: 'name' | 'description'; keywords: string[] }

export type CollectionRule = {
  all?: RuleCondition[]
  any?: RuleCondition[]
}

export type CollectionSort = 'catalogue' | 'price_asc' | 'price_desc' | 'newest'
export type CollectionSource = 'rule' | 'manual'
export type CollectionStatus = 'draft' | 'published'

export type CollectionDef = {
  id?: string
  slug: string
  title: string
  kicker: string
  description: string
  imageUrl?: string | null
  source: CollectionSource
  rule: CollectionRule
  sort: CollectionSort
  status: CollectionStatus
  showInStore: boolean
  showInBusiness: boolean
  /** Listed on /collections. Homepage-only groups stay unlisted. */
  listed: boolean
  schedule?: Schedule
  position: number
  /** Manual collections: the products in order. Rule collections: pinned first. */
  productIds: string[]
}

export type ProductSource =
  /** The built-in automatic picks (hero mix, bestseller score). */
  | { kind: 'auto' }
  | { kind: 'collection'; collectionSlug: string }

export type HeroStat = { title: string; text: string }
export type OccasionCard = {
  title: string
  kicker: string
  line: string
  href: string
  /** Collection whose products fill the card photos and the "From" price. */
  collectionSlug: string
  size: 'large' | 'small'
}
export type PackagingIcon = 'gift' | 'pen' | 'truck' | 'map' | 'search'
export type PackagingTile = { title: string; description: string; icon: PackagingIcon }

export type SectionType = 'hero' | 'occasion_grid' | 'product_rail' | 'brand_row' | 'packaging' | 'catalogue_grid'

type SectionBase = {
  visible: boolean
  position: number
  schedule?: Schedule
  eyebrow?: string
  /** Wrap words in *asterisks* to set them in the italic saffron accent. */
  heading: string
  subtext?: string
  ctaLabel?: string
  ctaHref?: string
}

export type HeroContent = SectionBase & {
  type: 'hero'
  cta2Label?: string
  cta2Href?: string
  source: ProductSource
  /** Products across all slides (4 per slide). */
  itemCount: number
  stats: HeroStat[]
}
export type OccasionGridContent = SectionBase & { type: 'occasion_grid'; cards: OccasionCard[] }
export type ProductRailContent = SectionBase & {
  type: 'product_rail'
  source: ProductSource
  itemCount: number
  columns: 4 | 5 | 6
  dark: boolean
}
export type BrandRowContent = SectionBase & { type: 'brand_row' }
export type PackagingContent = SectionBase & {
  type: 'packaging'
  /** Two photo URLs. Empty uses the automatic gift-box photos. */
  imageUrls: string[]
  tiles: PackagingTile[]
}
export type CatalogueGridContent = SectionBase & { type: 'catalogue_grid'; itemCount: number }

export type SectionContent =
  | HeroContent
  | OccasionGridContent
  | ProductRailContent
  | BrandRowContent
  | PackagingContent
  | CatalogueGridContent

export type HomepageSection = {
  id?: string
  key: string
  type: SectionType
  content: SectionContent
}

/** A dated override. Section slots replace fields; card slots replace or add an occasion card. */
export type SlotContent = {
  label: string
  schedule: Schedule
  priority: number
  target: 'section' | 'card'
  /** Card slots: 1-based card to replace. Empty adds the card at the end. */
  cardPosition?: number | null
  overrides?: Partial<Pick<SectionBase, 'eyebrow' | 'heading' | 'subtext' | 'ctaLabel' | 'ctaHref'>> & {
    source?: ProductSource
  }
  card?: OccasionCard
}

export type HomepageSlot = {
  id?: string
  sectionKey: string
  content: SlotContent
  createdAt?: string
}

export type HomepageConfig = {
  sections: HomepageSection[]
  slots: HomepageSlot[]
}
