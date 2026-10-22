import type { PublicProduct } from '@/lib/catalogue/products'
import { curateTrendingProducts, retailHeroSlides } from '@/lib/catalogue/curate'
import { collectionProducts } from './rules'
import { activeSlots, inWindow } from './schedule'
import type {
  BrandRowContent,
  CatalogueGridContent,
  CollectionDef,
  HeroContent,
  HomepageConfig,
  HomepageSection,
  OccasionCard,
  OccasionGridContent,
  PackagingContent,
  ProductRailContent,
  ProductSource,
  SectionContent,
} from './types'

export type ResolvedSection =
  | { key: string; type: 'hero'; content: HeroContent; slides: PublicProduct[][] }
  | { key: string; type: 'occasion_grid'; content: OccasionGridContent; cards: { card: OccasionCard; items: PublicProduct[] }[] }
  | { key: string; type: 'product_rail'; content: ProductRailContent; products: PublicProduct[] }
  | { key: string; type: 'brand_row'; content: BrandRowContent }
  | { key: string; type: 'packaging'; content: PackagingContent; photos: { key: string; src: string; alt: string }[] }
  | { key: string; type: 'catalogue_grid'; content: CatalogueGridContent }

export type ResolveOptions = {
  /** India date, YYYY-MM-DD. */
  date: string
  /** Preview also uses collections still in draft. */
  includeDraftCollections?: boolean
}

function withImage(products: PublicProduct[]) {
  const pictured = products.filter((product) => product.image_url)
  return pictured.length ? pictured : products
}

/** A collection the homepage may use on this date. */
export function collectionAvailable(collection: CollectionDef, options: ResolveOptions) {
  if (collection.status !== 'published' && !options.includeDraftCollections) return false
  if (!collection.showInStore) return false
  return inWindow(collection.schedule, options.date)
}

/**
 * Sections in order, with the date's seasonal slots applied. Hidden and out-of-window
 * sections are dropped. Section slot: the top active slot overrides copy and source.
 * Card slot: replaces the card at its position (higher priority wins) or is added at the end.
 */
export function effectiveSections(config: HomepageConfig, date: string): HomepageSection[] {
  const ordered = [...config.sections].sort((a, b) => a.content.position - b.content.position)
  const result: HomepageSection[] = []
  for (const section of ordered) {
    if (!section.content.visible || !inWindow(section.content.schedule, date)) continue
    const slots = activeSlots(config.slots.filter((slot) => slot.sectionKey === section.key), date)
    let content: SectionContent = section.content
    const sectionSlot = slots.find((slot) => slot.content.target === 'section')
    if (sectionSlot?.content.overrides) {
      const { source, ...copy } = sectionSlot.content.overrides
      const cleanCopy = Object.fromEntries(Object.entries(copy).filter(([, value]) => typeof value === 'string' && value.trim() !== ''))
      content = { ...content, ...cleanCopy } as SectionContent
      if (source && (content.type === 'hero' || content.type === 'product_rail')) content = { ...content, source }
    }
    if (content.type === 'occasion_grid') {
      const cards = [...content.cards]
      const replaced = new Set<number>()
      const added: OccasionCard[] = []
      for (const slot of slots) {
        if (slot.content.target !== 'card' || !slot.content.card) continue
        const position = slot.content.cardPosition
        if (position != null && position >= 1 && position <= cards.length) {
          if (replaced.has(position)) continue
          replaced.add(position)
          cards[position - 1] = slot.content.card
        } else {
          added.push(slot.content.card)
        }
      }
      content = { ...content, cards: [...cards, ...added] }
    }
    result.push({ ...section, content })
  }
  return result
}

function sourceProducts(
  source: ProductSource,
  products: PublicProduct[],
  collections: Map<string, CollectionDef>,
  options: ResolveOptions,
): PublicProduct[] | null {
  if (source.kind !== 'collection') return null
  const collection = collections.get(source.collectionSlug)
  if (!collection || !collectionAvailable(collection, options)) return []
  return collectionProducts(products, collection)
}

function chunkSlides(products: PublicProduct[], itemCount: number, perSlide = 4) {
  const seenImages = new Set<string>()
  const unique = withImage(products).filter((product) => {
    const image = product.image_url || ''
    if (!image || seenImages.has(image)) return false
    seenImages.add(image)
    return true
  }).slice(0, itemCount)
  const slides: PublicProduct[][] = []
  for (let index = 0; index + perSlide <= unique.length; index += perSlide) slides.push(unique.slice(index, index + perSlide))
  if (!slides.length && unique.length) slides.push(unique.slice(0, perSlide))
  return slides
}

const PACKAGING_NAME = /gift box|hamper|gift set|basket|crate|box/i
const PACKAGING_EXCLUDE = /badge|lanyard|holder/i

export function resolveHomepage(
  config: HomepageConfig,
  collectionList: CollectionDef[],
  products: PublicProduct[],
  options: ResolveOptions,
): ResolvedSection[] {
  const collections = new Map(collectionList.map((collection) => [collection.slug, collection]))
  const sections = effectiveSections(config, options.date)
  const resolved: ResolvedSection[] = []

  for (const section of sections) {
    const content = section.content
    switch (content.type) {
      case 'hero': {
        const picked = sourceProducts(content.source, products, collections, options)
        const slides = picked
          ? chunkSlides(picked, content.itemCount)
          : retailHeroSlides(products, 4, Math.max(1, Math.ceil(content.itemCount / 4)))
        resolved.push({ key: section.key, type: 'hero', content, slides })
        break
      }
      case 'occasion_grid': {
        const cards = content.cards
          .map((card) => {
            const collection = collections.get(card.collectionSlug)
            if (!collection || !collectionAvailable(collection, options)) return null
            return { card, items: collectionProducts(products, collection) }
          })
          .filter((card): card is { card: OccasionCard; items: PublicProduct[] } => card !== null)
        resolved.push({ key: section.key, type: 'occasion_grid', content, cards })
        break
      }
      case 'product_rail': {
        const picked = sourceProducts(content.source, products, collections, options)
        const list = picked ?? curateTrendingProducts(products, content.itemCount)
        resolved.push({ key: section.key, type: 'product_rail', content, products: withImage(list).slice(0, content.itemCount) })
        break
      }
      case 'brand_row':
        resolved.push({ key: section.key, type: 'brand_row', content })
        break
      case 'packaging': {
        const urls = content.imageUrls.filter((url) => typeof url === 'string' && url.trim())
        let photos: { key: string; src: string; alt: string }[]
        if (urls.length) {
          photos = urls.slice(0, 2).map((src, index) => ({ key: `custom-${index}`, src, alt: '' }))
        } else {
          const festive = resolved.find((item) => item.key === 'festive')
          const festiveIds = new Set(festive?.type === 'product_rail' ? festive.products.map((product) => product.id) : [])
          photos = products
            .filter(
              (product) =>
                product.image_url &&
                !festiveIds.has(product.id) &&
                PACKAGING_NAME.test(product.name) &&
                !PACKAGING_EXCLUDE.test(product.name),
            )
            .slice(0, 2)
            .map((product) => ({ key: product.id, src: product.image_url as string, alt: product.name }))
        }
        resolved.push({ key: section.key, type: 'packaging', content, photos })
        break
      }
      case 'catalogue_grid':
        resolved.push({ key: section.key, type: 'catalogue_grid', content })
        break
    }
  }
  return resolved
}

export { headingParts, plainHeading } from './heading'
