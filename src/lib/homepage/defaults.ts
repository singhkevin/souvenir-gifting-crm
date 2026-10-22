import { siteContent } from '@/config/siteContent'
import type { CollectionDef, HomepageConfig, HomepageSection, PackagingIcon } from './types'

/**
 * Built-in content. The homepage renders this when the homepage tables are absent or
 * empty, and the seed file (20261022_homepage_cms_seed.sql) is generated from it, so the
 * page looks the same on day one. Copy is verbatim from the coded homepage.
 */

type CollectionSeed = Omit<CollectionDef, 'status' | 'showInStore' | 'showInBusiness' | 'listed' | 'position' | 'productIds' | 'imageUrl' | 'schedule'> &
  Partial<Pick<CollectionDef, 'listed'>>

const COLLECTION_SEEDS: CollectionSeed[] = [
  {
    slug: 'executive-edit',
    title: 'The Executive Edit',
    kicker: 'Collection',
    description: 'Premium gifts for leadership and VIP clients.',
    source: 'rule',
    rule: {
      any: [
        { field: 'category', in: ['Apparel', 'Bags & Travel', 'Awards & Recognition', 'Watches'] },
        { field: 'price', gte: 2500 },
      ],
    },
    sort: 'catalogue',
  },
  {
    slug: 'new-joiner-essentials',
    title: 'New Joiner Essentials',
    kicker: 'Collection',
    description: 'Thoughtful employee onboarding from the live catalogue.',
    source: 'rule',
    rule: {
      any: [
        { field: 'category', in: ['Welcome Kits'] },
        { field: 'name', keywords: ['welcome', 'onboard', 'lanyard', 'kit'] },
        { field: 'description', keywords: ['welcome', 'onboard'] },
      ],
    },
    sort: 'catalogue',
  },
  {
    slug: 'client-appreciation',
    title: 'Client Appreciation',
    kicker: 'Collection',
    description: 'Gifts that strengthen business relationships.',
    source: 'rule',
    rule: { any: [{ field: 'category', in: ['Hampers & Gift Sets', 'Awards & Recognition', 'Home & Lifestyle'] }] },
    sort: 'catalogue',
  },
  {
    slug: 'festival-gifting',
    title: 'Festive Corporate',
    kicker: 'Collection',
    description: 'Premium seasonal gifting for celebrations and festivals.',
    source: 'rule',
    rule: {
      any: [
        { field: 'category', in: ['Hampers & Gift Sets'] },
        { field: 'name', keywords: ['festive', 'hamper', 'celebration'] },
      ],
    },
    sort: 'catalogue',
  },
  {
    slug: 'conference-and-events',
    title: 'Conference & Events',
    kicker: 'Collection',
    description: 'Drinkware, desk pieces and tech for events and offsites.',
    source: 'rule',
    rule: { any: [{ field: 'category', in: ['Drinkware', 'Desk & Stationery', 'Tech & Electronics'] }] },
    sort: 'catalogue',
  },
  {
    slug: 'welcome-kits',
    title: 'Welcome Kits',
    kicker: 'Collection',
    description: 'The Welcome Kits category, presented as a programme.',
    source: 'rule',
    rule: { any: [{ field: 'category', in: ['Welcome Kits'] }] },
    sort: 'catalogue',
  },
  {
    slug: 'sustainable-gifting',
    title: 'The Sustainable Edit',
    kicker: 'Collection',
    description: 'Thoughtful eco-conscious gifting from the catalogue.',
    source: 'rule',
    rule: {
      any: [
        { field: 'category', in: ['Eco-Friendly Gifts'] },
        { field: 'name', keywords: ['recycled', 'bamboo', 'eco', 'sustainable'] },
      ],
    },
    sort: 'catalogue',
  },
  {
    slug: 'premium-corporate-gifts',
    title: 'Premium Corporate Gifts',
    kicker: 'Collection',
    description: 'Higher-value catalogue pieces, selected from existing prices.',
    source: 'rule',
    rule: { any: [{ field: 'price', gte: 2000 }] },
    sort: 'catalogue',
  },
  {
    slug: 'desk-essentials',
    title: 'Desk Essentials',
    kicker: 'Collection',
    description: 'Stationery and desk accessories for everyday branded presence.',
    source: 'rule',
    rule: { any: [{ field: 'category', in: ['Desk & Stationery'] }] },
    sort: 'catalogue',
  },
  {
    slug: 'premium-tech',
    title: 'Premium Tech',
    kicker: 'Collection',
    description: 'Smart products for modern teams.',
    source: 'rule',
    rule: { any: [{ field: 'category', in: ['Tech & Electronics'] }] },
    sort: 'catalogue',
  },
  {
    // The products the festive band showed before the homepage was editable.
    slug: 'festive-band-current',
    title: 'Festive band (current)',
    kicker: 'Seasonal',
    description: 'Festive-tagged products, the Hampers & Gift Sets category, and festive, Diwali or hamper names.',
    source: 'rule',
    rule: {
      any: [
        { field: 'occasion', in: ['festive'] },
        { field: 'category', in: ['Hampers & Gift Sets'] },
        { field: 'name', keywords: ['festive', 'diwali', 'hamper'] },
      ],
    },
    sort: 'catalogue',
    listed: false,
  },
  {
    slug: 'under-999',
    title: 'Under ₹999',
    kicker: 'Everyday',
    description: 'Priced products under ₹999, lowest price first.',
    source: 'rule',
    rule: { all: [{ field: 'price', gt: 0, lt: 999 }] },
    sort: 'price_asc',
    listed: false,
  },
]

export const DEFAULT_COLLECTIONS: CollectionDef[] = COLLECTION_SEEDS.map((seed, index) => ({
  ...seed,
  imageUrl: null,
  status: 'published',
  showInStore: true,
  showInBusiness: true,
  listed: seed.listed ?? true,
  schedule: {},
  position: (index + 1) * 10,
  productIds: [],
}))

const PACKAGING_ICON_ORDER: PackagingIcon[] = ['gift', 'pen', 'truck', 'map', 'search']

export const DEFAULT_SECTIONS: HomepageSection[] = [
  {
    key: 'hero',
    type: 'hero',
    content: {
      type: 'hero',
      visible: true,
      position: 10,
      eyebrow: 'The Souvenir Collection',
      heading: 'Thoughtful gifting, *handcrafted* to be cherished.',
      subtext:
        'Thoughtfully assembled keepsakes, brassware, and gift hampers for personal celebrations, weddings, anniversaries, and homes.',
      ctaLabel: 'Explore Catalogue',
      ctaHref: '/catalogue',
      cta2Label: 'Request a Quote',
      cta2Href: '/request-quote',
      source: { kind: 'auto' },
      itemCount: 12,
      // TODO(client): the four stat lines are placeholders from siteContent until verified.
      stats: [
        { title: siteContent.stats.dispatch, text: siteContent.retail.dispatchCities },
        { title: 'Gift packaging', text: siteContent.retail.packagingNote },
        { title: 'Payment', text: siteContent.retail.paymentMethods },
        { title: 'Direct gifting', text: siteContent.retail.directDispatchNote },
      ],
    },
  },
  {
    key: 'occasions',
    type: 'occasion_grid',
    content: {
      type: 'occasion_grid',
      visible: true,
      position: 20,
      eyebrow: 'Collections',
      heading: 'Gifts by occasion',
      ctaLabel: 'View All Collections',
      ctaHref: '/collections',
      cards: [
        { title: 'Festive & Diwali Hampers', kicker: 'Seasonal', line: 'Hampers and festive boxes from the catalogue', href: '/collections/festival-gifting', collectionSlug: 'festival-gifting', size: 'large' },
        { title: 'Day-One Welcome Kits', kicker: 'HR & People', line: 'Onboarding sets ready to brand', href: '/collections/welcome-kits', collectionSlug: 'welcome-kits', size: 'large' },
        { title: 'Client & CXO Appreciation', kicker: 'Executive', line: 'Gifts for the relationships you keep', href: '/collections/client-appreciation', collectionSlug: 'client-appreciation', size: 'large' },
        { title: 'Onboarding Essentials', kicker: 'First day', line: 'Kits and desk pieces for new joiners', href: '/collections/new-joiner-essentials', collectionSlug: 'new-joiner-essentials', size: 'small' },
        { title: 'Conferences & Summits', kicker: 'Events', line: 'Drinkware, desk and tech for the room', href: '/collections/conference-and-events', collectionSlug: 'conference-and-events', size: 'small' },
        { title: 'Work Anniversary', kicker: 'Milestones', line: 'Recognition pieces for tenure and loyalty', href: '/collections/executive-edit', collectionSlug: 'executive-edit', size: 'small' },
      ],
    },
  },
  {
    key: 'bestsellers',
    type: 'product_rail',
    content: {
      type: 'product_rail',
      visible: true,
      position: 30,
      eyebrow: 'Most Requested',
      heading: 'Retail Bestsellers — Ready to Ship',
      ctaLabel: 'View All',
      ctaHref: '/catalogue?sort=newest',
      source: { kind: 'auto' },
      itemCount: 5,
      columns: 5,
      dark: false,
    },
  },
  {
    key: 'brands',
    type: 'brand_row',
    content: {
      type: 'brand_row',
      visible: true,
      position: 40,
      eyebrow: 'Brands we work with',
      heading: 'Brand partners',
      subtext: 'Branded products available through our catalogue.',
      ctaLabel: 'View All Brands',
      ctaHref: '/catalogue',
    },
  },
  {
    key: 'under-999',
    type: 'product_rail',
    content: {
      type: 'product_rail',
      visible: true,
      position: 50,
      eyebrow: 'Everyday',
      heading: 'Merchandise under ₹999',
      ctaLabel: 'View All',
      ctaHref: '/catalogue?priceMax=998',
      source: { kind: 'collection', collectionSlug: 'under-999' },
      itemCount: 6,
      columns: 6,
      dark: false,
    },
  },
  {
    key: 'festive',
    type: 'product_rail',
    content: {
      type: 'product_rail',
      visible: true,
      position: 60,
      eyebrow: 'Seasonal Editions',
      heading: 'Festive Gift Hampers',
      ctaLabel: 'View All',
      ctaHref: '/collections/festival-gifting',
      source: { kind: 'collection', collectionSlug: 'festive-band-current' },
      itemCount: 4,
      columns: 4,
      dark: true,
    },
  },
  {
    key: 'packaging',
    type: 'packaging',
    content: {
      type: 'packaging',
      visible: true,
      position: 70,
      eyebrow: 'Packaging & delivery',
      heading: 'Every Gift, an Unforgettable *Unboxing Experience*.',
      imageUrls: [],
      // TODO(client): confirm each tile is actually offered.
      tiles: siteContent.retail.packagingSteps.map((step, index) => ({
        title: step.title,
        description: step.description,
        icon: PACKAGING_ICON_ORDER[index] || 'gift',
      })),
    },
  },
  {
    key: 'catalogue',
    type: 'catalogue_grid',
    content: {
      type: 'catalogue_grid',
      visible: true,
      position: 80,
      heading: 'Gift catalogue',
      subtext: 'Filter the live catalogue by category, brand, price and occasion.',
      itemCount: 8,
    },
  },
]

export const DEFAULT_HOMEPAGE: HomepageConfig = { sections: DEFAULT_SECTIONS, slots: [] }

export function defaultCollectionBySlug(slug: string) {
  return DEFAULT_COLLECTIONS.find((collection) => collection.slug === slug) || null
}
