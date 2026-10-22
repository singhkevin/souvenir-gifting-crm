import { slugify } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'
import { DEFAULT_COLLECTIONS } from '@/lib/homepage/defaults'
import { matchRule } from '@/lib/homepage/rules'

export type CatalogueCollection = {
  slug: string
  title: string
  kicker: string
  description: string
  match: (product: PublicProduct) => boolean
}

/**
 * Editorial collections: rule-based views over the existing catalogue, not a second
 * product system. These are the built-in definitions (DEFAULT_COLLECTIONS); once the
 * collections table exists the CRM edits them there (src/lib/homepage/collections-server.ts).
 * Homepage-only groups (listed: false) are left out of this list.
 */
export const CATALOGUE_COLLECTIONS: CatalogueCollection[] = DEFAULT_COLLECTIONS.filter((collection) => collection.listed).map(
  (collection) => ({
    slug: collection.slug,
    title: collection.title,
    kicker: collection.kicker,
    description: collection.description,
    match: (product: PublicProduct) => matchRule(product, collection.rule),
  }),
)

/** Occasion discovery maps to existing categories/collections — no fabricated occasion field. */
export const CATALOGUE_OCCASIONS = [
  {
    slug: 'employee-onboarding',
    title: 'Employee Onboarding',
    line: 'First-day kits that set the tone',
    href: '/collections/new-joiner-essentials',
  },
  {
    slug: 'client-appreciation',
    title: 'Client Appreciation',
    line: 'Thank-you gifts with lasting presence',
    href: '/collections/client-appreciation',
  },
  {
    slug: 'annual-meet',
    title: 'Annual Meet',
    line: 'Recognition and keepsakes for big rooms',
    href: '/collections/executive-edit',
  },
  {
    slug: 'conference-events',
    title: 'Conference & Events',
    line: 'Practical gifts for offsites and summits',
    href: '/collections/conference-and-events',
  },
  {
    slug: 'festive-gifting',
    title: 'Festive Gifting',
    line: 'Seasonal programmes at scale',
    href: '/collections/festival-gifting',
  },
  {
    slug: 'work-anniversary',
    title: 'Work Anniversary',
    line: 'Milestone gifts for tenure and loyalty',
    href: '/collections/executive-edit',
  },
]

export const BUDGET_BANDS = [
  { id: '0-500', label: 'Under ₹500', min: 0, max: 500 },
  { id: '500-1000', label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { id: '1000-2000', label: '₹1,000 – ₹2,000', min: 1000, max: 2000 },
  { id: '2000-5000', label: '₹2,000 – ₹5,000', min: 2000, max: 5000 },
  { id: '5000+', label: 'Premium', min: 5000, max: Infinity },
] as const

export function collectionBySlug(slug: string) {
  return CATALOGUE_COLLECTIONS.find((collection) => collection.slug === slug) || null
}

export function productsInCollection(products: PublicProduct[], slug: string) {
  const collection = collectionBySlug(slug)
  if (!collection) return []
  return products.filter(collection.match)
}

export function categorySlug(name: string) {
  return slugify(name)
}
