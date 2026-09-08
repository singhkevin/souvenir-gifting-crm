import { slugify } from '@/lib/utils'
import type { PublicProduct } from '@/lib/catalogue/products'

export type CatalogueCollection = {
  slug: string
  title: string
  kicker: string
  description: string
  match: (product: PublicProduct) => boolean
}

/** Editorial collections — filters over existing catalogue data, not a second product system. */
export const CATALOGUE_COLLECTIONS: CatalogueCollection[] = [
  {
    slug: 'executive-edit',
    title: 'The Executive Edit',
    kicker: 'Collection',
    description: 'Premium gifts for leadership and VIP clients.',
    match: (product) =>
      ['Apparel', 'Bags & Travel', 'Awards & Recognition', 'Watches'].includes(product.category_name || '') ||
      (product.price || 0) >= 2500,
  },
  {
    slug: 'new-joiner-essentials',
    title: 'New Joiner Essentials',
    kicker: 'Collection',
    description: 'Thoughtful employee onboarding from the live catalogue.',
    match: (product) =>
      product.category_name === 'Welcome Kits' ||
      /welcome|onboard|lanyard|kit/i.test(product.name) ||
      /welcome|onboard/i.test(product.description || ''),
  },
  {
    slug: 'client-appreciation',
    title: 'Client Appreciation',
    kicker: 'Collection',
    description: 'Gifts that strengthen business relationships.',
    match: (product) =>
      ['Hampers & Gift Sets', 'Awards & Recognition', 'Home & Lifestyle'].includes(product.category_name || ''),
  },
  {
    slug: 'festival-gifting',
    title: 'Festive Corporate',
    kicker: 'Collection',
    description: 'Premium seasonal gifting for celebrations and festivals.',
    match: (product) =>
      product.category_name === 'Hampers & Gift Sets' || /festive|hamper|celebration/i.test(product.name),
  },
  {
    slug: 'conference-and-events',
    title: 'Conference & Events',
    kicker: 'Collection',
    description: 'Drinkware, desk pieces and tech for events and offsites.',
    match: (product) =>
      ['Drinkware', 'Desk & Stationery', 'Tech & Electronics'].includes(product.category_name || ''),
  },
  {
    slug: 'welcome-kits',
    title: 'Welcome Kits',
    kicker: 'Collection',
    description: 'The Welcome Kits category, presented as a programme.',
    match: (product) => product.category_name === 'Welcome Kits',
  },
  {
    slug: 'sustainable-gifting',
    title: 'The Sustainable Edit',
    kicker: 'Collection',
    description: 'Thoughtful eco-conscious gifting from the catalogue.',
    match: (product) =>
      product.category_name === 'Eco-Friendly Gifts' || /recycled|bamboo|eco|sustainable/i.test(product.name),
  },
  {
    slug: 'premium-corporate-gifts',
    title: 'Premium Corporate Gifts',
    kicker: 'Collection',
    description: 'Higher-value catalogue pieces, selected from existing prices.',
    match: (product) => (product.price || 0) >= 2000,
  },
  {
    slug: 'desk-essentials',
    title: 'Desk Essentials',
    kicker: 'Collection',
    description: 'Stationery and desk accessories for everyday branded presence.',
    match: (product) => product.category_name === 'Desk & Stationery',
  },
  {
    slug: 'premium-tech',
    title: 'Premium Tech',
    kicker: 'Collection',
    description: 'Smart products for modern teams.',
    match: (product) => product.category_name === 'Tech & Electronics',
  },
]

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
