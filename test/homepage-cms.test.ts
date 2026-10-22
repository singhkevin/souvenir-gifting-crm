import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { CATALOGUE_COLLECTIONS } from '../src/lib/catalogue/collections.ts'
import { curateTrendingProducts, retailHeroSlides } from '../src/lib/catalogue/curate.ts'
import type { PublicProduct } from '../src/lib/catalogue/products.ts'
import { configFromRows, collectionsFromRows, isMissingTable, type SectionRow, type SlotRow } from '../src/lib/homepage/config.ts'
import { DEFAULT_COLLECTIONS, DEFAULT_HOMEPAGE, DEFAULT_SECTIONS } from '../src/lib/homepage/defaults.ts'
import { headingParts, plainHeading } from '../src/lib/homepage/heading.ts'
import { collectionFromRow, normalizeSectionContent, normalizeSlotContent, safeHref } from '../src/lib/homepage/normalize.ts'
import { effectiveSections, resolveHomepage } from '../src/lib/homepage/resolve.ts'
import { collectionProducts, matchRule } from '../src/lib/homepage/rules.ts'
import { activeSlots, inWindow, indiaDate } from '../src/lib/homepage/schedule.ts'
import { homepageSeedSql } from '../src/lib/homepage/seed-sql.ts'
import type { HomepageConfig, HomepageSlot, OccasionCard, SlotContent } from '../src/lib/homepage/types.ts'

// ---------------------------------------------------------------------------
// Fixture: a deterministic catalogue covering every category and keyword the rules use.

const CATEGORIES = [
  'Apparel', 'Bags & Travel', 'Awards & Recognition', 'Watches', 'Welcome Kits', 'Hampers & Gift Sets',
  'Home & Lifestyle', 'Drinkware', 'Desk & Stationery', 'Tech & Electronics', 'Eco-Friendly Gifts', null,
]
const NAMES = [
  'Steel Bottle', 'Diwali Hamper', 'Festive Gift Box', 'Welcome Kit', 'Onboarding Lanyard', 'Bamboo Pen',
  'Recycled Notebook', 'Crystal Award', 'Leather Watch', 'Celebration Crate', 'Desk Organiser', 'Badge Holder',
  'Wireless Charger', 'Eco Tote', 'Gift Set Classic', 'Brass Diya', 'Sustainable Mug', 'Coffee Basket',
]
function fixture(count = 240): PublicProduct[] {
  const items: PublicProduct[] = []
  for (let index = 0; index < count; index += 1) {
    const prices = [null, 0, 120, 450, 998, 999, 1500, 2000, 2499, 2500, 4800]
    items.push({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      name: `${NAMES[index % NAMES.length]} ${index}`,
      sku: `SKU-${index}`,
      description: index % 7 === 0 ? 'Great for welcome days' : index % 11 === 0 ? 'Onboard your team' : null,
      image_url: index % 5 === 3 ? null : `/img/${index % 97}.webp`,
      price: prices[index % prices.length],
      moq: null,
      category_id: null,
      category_name: CATEGORIES[index % CATEGORIES.length],
      brand_id: null,
      brand_name: null,
      brand_logo_url: null,
      occasion_tags: index % 9 === 0 ? ['festive'] : index % 13 === 0 ? ['onboarding'] : [],
      status: 'active',
      created_at: `2026-0${1 + (index % 9)}-1${index % 10}T00:00:00Z`,
      purchase: {} as PublicProduct['purchase'],
    })
  }
  return items
}
const PRODUCTS = fixture()

// The coded collection matchers before the homepage became editable (copied verbatim).
const LEGACY_MATCH: Record<string, (product: PublicProduct) => boolean> = {
  'executive-edit': (product) =>
    ['Apparel', 'Bags & Travel', 'Awards & Recognition', 'Watches'].includes(product.category_name || '') || (product.price || 0) >= 2500,
  'new-joiner-essentials': (product) =>
    product.category_name === 'Welcome Kits' || /welcome|onboard|lanyard|kit/i.test(product.name) || /welcome|onboard/i.test(product.description || ''),
  'client-appreciation': (product) => ['Hampers & Gift Sets', 'Awards & Recognition', 'Home & Lifestyle'].includes(product.category_name || ''),
  'festival-gifting': (product) => product.category_name === 'Hampers & Gift Sets' || /festive|hamper|celebration/i.test(product.name),
  'conference-and-events': (product) => ['Drinkware', 'Desk & Stationery', 'Tech & Electronics'].includes(product.category_name || ''),
  'welcome-kits': (product) => product.category_name === 'Welcome Kits',
  'sustainable-gifting': (product) => product.category_name === 'Eco-Friendly Gifts' || /recycled|bamboo|eco|sustainable/i.test(product.name),
  'premium-corporate-gifts': (product) => (product.price || 0) >= 2000,
  'desk-essentials': (product) => product.category_name === 'Desk & Stationery',
  'premium-tech': (product) => product.category_name === 'Tech & Electronics',
}

function withImage(products: PublicProduct[]) {
  const pictured = products.filter((product) => product.image_url)
  return pictured.length ? pictured : products
}
const ids = (products: { id: string }[]) => products.map((product) => product.id)
const TODAY = '2026-10-22'

// ---------------------------------------------------------------------------
// Date windows

test('inWindow: inclusive bounds, open ends, no schedule', () => {
  const window = { startsOn: '2026-10-20', endsOn: '2026-11-05' }
  assert.equal(inWindow(window, '2026-10-19'), false)
  assert.equal(inWindow(window, '2026-10-20'), true)
  assert.equal(inWindow(window, '2026-11-05'), true)
  assert.equal(inWindow(window, '2026-11-06'), false)
  assert.equal(inWindow({ startsOn: '2026-10-20' }, '2030-01-01'), true)
  assert.equal(inWindow({ endsOn: '2026-10-20' }, '2026-10-21'), false)
  assert.equal(inWindow(undefined, TODAY), true)
  assert.equal(inWindow({}, TODAY), true)
  // Invalid dates are ignored rather than hiding the section.
  assert.equal(inWindow({ startsOn: '2026-13-40' }, TODAY), true)
})

test('inWindow: yearly repeat ignores the year and wraps the new year', () => {
  const diwali = { startsOn: '2025-10-15', endsOn: '2025-11-10', repeatYearly: true }
  assert.equal(inWindow(diwali, '2026-10-22'), true)
  assert.equal(inWindow(diwali, '2031-11-10'), true)
  assert.equal(inWindow(diwali, '2026-11-11'), false)
  assert.equal(inWindow({ ...diwali, repeatYearly: false }, '2026-10-22'), false)
  const newYear = { startsOn: '2026-12-20', endsOn: '2027-01-05', repeatYearly: true }
  assert.equal(inWindow(newYear, '2027-12-25'), true)
  assert.equal(inWindow(newYear, '2028-01-03'), true)
  assert.equal(inWindow(newYear, '2028-01-06'), false)
  assert.equal(inWindow(newYear, '2028-12-19'), false)
  assert.equal(inWindow({ startsOn: '2020-12-01', repeatYearly: true }, '2026-12-31'), true)
  assert.equal(inWindow({ startsOn: '2020-12-01', repeatYearly: true }, '2026-11-30'), false)
})

test('indiaDate: the date in Asia/Kolkata, not UTC', () => {
  assert.equal(indiaDate(new Date('2026-10-21T18:29:00Z')), '2026-10-21')
  assert.equal(indiaDate(new Date('2026-10-21T18:30:00Z')), '2026-10-22')
  assert.equal(indiaDate(new Date('2026-12-31T20:00:00Z')), '2027-01-01')
})

// ---------------------------------------------------------------------------
// Priority

function slot(label: string, extra: Partial<SlotContent> = {}, createdAt = '2026-10-01T00:00:00Z'): HomepageSlot {
  return {
    sectionKey: 'bestsellers',
    createdAt,
    content: { label, schedule: { startsOn: '2026-10-01', endsOn: '2026-10-31' }, priority: 0, target: 'section', overrides: {}, ...extra },
  }
}

test('activeSlots: in-window only, higher priority first, then later start, then newer', () => {
  const slots = [
    slot('low', { priority: 1 }),
    slot('high', { priority: 5 }),
    slot('expired', { priority: 9, schedule: { startsOn: '2026-09-01', endsOn: '2026-09-30' } }),
    slot('later-start', { priority: 1, schedule: { startsOn: '2026-10-10', endsOn: '2026-10-31' } }),
    slot('newer', { priority: 1 }, '2026-10-05T00:00:00Z'),
  ]
  assert.deepEqual(activeSlots(slots, TODAY).map((item) => item.content.label), ['high', 'later-start', 'newer', 'low'])
  assert.deepEqual(activeSlots(slots, '2026-09-15').map((item) => item.content.label), ['expired'])
})

test('effectiveSections: top section slot overrides copy and source; blanks do not erase', () => {
  const config: HomepageConfig = {
    sections: DEFAULT_SECTIONS,
    slots: [
      slot('diwali', { priority: 2, overrides: { heading: 'Diwali bestsellers', ctaLabel: '  ', source: { kind: 'collection', collectionSlug: 'festive-band-current' } } }),
      slot('weaker', { priority: 1, overrides: { heading: 'Should not win' } }),
    ],
  }
  const rail = effectiveSections(config, TODAY).find((section) => section.key === 'bestsellers')!
  assert.equal(rail.content.heading, 'Diwali bestsellers')
  assert.equal(rail.content.ctaLabel, 'View All')
  assert.deepEqual((rail.content as { source: unknown }).source, { kind: 'collection', collectionSlug: 'festive-band-current' })
  const after = effectiveSections(config, '2026-11-01').find((section) => section.key === 'bestsellers')!
  assert.equal(after.content.heading, 'Retail Bestsellers — Ready to Ship')
})

test('effectiveSections: card slots replace by position (priority wins) or append', () => {
  const card = (title: string): OccasionCard => ({ title, kicker: 'Seasonal', line: '', href: '/collections/festival-gifting', collectionSlug: 'festival-gifting', size: 'large' })
  const cardSlot = (label: string, priority: number, cardPosition: number | null): HomepageSlot => ({
    sectionKey: 'occasions',
    content: { label, schedule: { startsOn: '2026-10-01', endsOn: '2026-10-31' }, priority, target: 'card', cardPosition, card: card(label) },
  })
  const config: HomepageConfig = {
    sections: DEFAULT_SECTIONS,
    slots: [cardSlot('first-low', 1, 1), cardSlot('first-high', 3, 1), cardSlot('extra', 0, null)],
  }
  const grid = effectiveSections(config, TODAY).find((section) => section.key === 'occasions')!
  const cards = (grid.content as { cards: OccasionCard[] }).cards
  assert.equal(cards.length, 7)
  assert.equal(cards[0].title, 'first-high')
  assert.equal(cards[1].title, 'Day-One Welcome Kits')
  assert.equal(cards[6].title, 'extra')
})

test('effectiveSections: hidden and out-of-window sections are dropped, order follows position', () => {
  const sections = DEFAULT_SECTIONS.map((section) =>
    section.key === 'brands'
      ? { ...section, content: { ...section.content, visible: false } }
      : section.key === 'festive'
        ? { ...section, content: { ...section.content, schedule: { startsOn: '2026-10-01', endsOn: '2026-10-31' } } }
        : section.key === 'catalogue'
          ? { ...section, content: { ...section.content, position: 1 } }
          : section,
  )
  const keys = (date: string) => effectiveSections({ sections, slots: [] }, date).map((section) => section.key)
  assert.deepEqual(keys(TODAY), ['catalogue', 'hero', 'occasions', 'bestsellers', 'under-999', 'festive', 'packaging'])
  assert.deepEqual(keys('2026-11-01'), ['catalogue', 'hero', 'occasions', 'bestsellers', 'under-999', 'packaging'])
})

// ---------------------------------------------------------------------------
// Fallback

test('fallback: missing, empty or unpublished tables give the built-in homepage', () => {
  assert.deepEqual(configFromRows(null, null, 'published'), { config: DEFAULT_HOMEPAGE, source: 'built-in' })
  assert.deepEqual(configFromRows([], [], 'published'), { config: DEFAULT_HOMEPAGE, source: 'built-in' })
  const unpublished: SectionRow[] = [{ id: 'a', section_key: 'hero', section_type: 'hero', draft: DEFAULT_SECTIONS[0].content, published: null }]
  assert.equal(configFromRows(unpublished, [], 'published').source, 'built-in')
  assert.equal(configFromRows(unpublished, [], 'draft').source, 'database')
  assert.equal(collectionsFromRows(null).source, 'built-in')
  assert.equal(collectionsFromRows([]).collections, DEFAULT_COLLECTIONS)
  assert.equal(isMissingTable({ code: '42P01', message: 'relation "public.homepage_sections" does not exist' }), true)
  assert.equal(isMissingTable({ code: 'PGRST205', message: "Could not find the table 'public.collections' in the schema cache" }), true)
  assert.equal(isMissingTable({ code: '42501', message: 'permission denied' }), false)
  assert.equal(isMissingTable(null), false)
})

test('fallback: a section row with an unknown type is skipped, bad fields are cleaned', () => {
  const rows: SectionRow[] = [
    { id: 'x', section_key: 'mystery', section_type: 'carousel', draft: {}, published: {} },
    { id: 'y', section_key: 'bestsellers', section_type: 'product_rail', draft: {}, published: { heading: 'Rail', columns: 9, ctaHref: 'javascript:alert(1)', itemCount: 'lots' } },
  ]
  const { config, source } = configFromRows(rows, [], 'published')
  assert.equal(source, 'database')
  assert.equal(config.sections.length, 1)
  const content = config.sections[0].content as { columns: number; ctaHref?: string; itemCount: number; visible: boolean }
  assert.equal(content.columns, 6)
  assert.equal(content.ctaHref, undefined)
  assert.equal(content.itemCount, 6)
  assert.equal(content.visible, true)
  assert.equal(safeHref('//evil.example'), undefined)
  assert.equal(safeHref('/collections/a'), '/collections/a')
})

test('slots: draft vs published, removed-in-draft, invalid slots dropped', () => {
  const sections: SectionRow[] = [{ id: 's1', section_key: 'bestsellers', section_type: 'product_rail', draft: DEFAULT_SECTIONS[2].content, published: DEFAULT_SECTIONS[2].content }]
  const live = { label: 'Live', schedule: { startsOn: '2026-10-01' }, priority: 0, target: 'section', overrides: { heading: 'Live' } }
  const slots: SlotRow[] = [
    { id: 'a', section_id: 's1', draft: null, published: live, created_at: '2026-10-01' },
    { id: 'b', section_id: 's1', draft: { ...live, label: 'Draft' }, published: null, created_at: '2026-10-02' },
    { id: 'c', section_id: 's1', draft: { label: 'No dates', schedule: {} }, published: { label: 'No dates', schedule: {} }, created_at: '2026-10-03' },
  ]
  assert.deepEqual(configFromRows(sections, slots, 'published').config.slots.map((item) => item.content.label), ['Live'])
  assert.deepEqual(configFromRows(sections, slots, 'draft').config.slots.map((item) => item.content.label), ['Draft'])
  assert.equal(normalizeSlotContent({ label: 'Card', schedule: { startsOn: '2026-10-01' }, target: 'card', card: { title: 'X', collectionSlug: 'Bad Slug' } }), null)
})

// ---------------------------------------------------------------------------
// Day one: seeded content equals the coded homepage

test('collections: rules match exactly what the coded collections matched', () => {
  assert.equal(CATALOGUE_COLLECTIONS.length, 10)
  for (const collection of CATALOGUE_COLLECTIONS) {
    const legacy = LEGACY_MATCH[collection.slug]
    assert.ok(legacy, collection.slug)
    assert.deepEqual(ids(PRODUCTS.filter(collection.match)), ids(PRODUCTS.filter(legacy)), collection.slug)
    assert.ok(PRODUCTS.filter(legacy).length > 0, `fixture covers ${collection.slug}`)
  }
})

test('homepage: defaults resolve to the same products as the coded homepage', () => {
  const resolved = resolveHomepage(DEFAULT_HOMEPAGE, DEFAULT_COLLECTIONS, PRODUCTS, { date: TODAY })
  assert.deepEqual(resolved.map((section) => section.key), ['hero', 'occasions', 'bestsellers', 'brands', 'under-999', 'festive', 'packaging', 'catalogue'])
  const byKey = Object.fromEntries(resolved.map((section) => [section.key, section]))

  const hero = byKey.hero
  assert.ok(hero.type === 'hero')
  assert.deepEqual(hero.slides.map(ids), retailHeroSlides(PRODUCTS).map(ids))

  const bestsellers = byKey.bestsellers
  assert.ok(bestsellers.type === 'product_rail')
  assert.deepEqual(ids(bestsellers.products), ids(withImage(curateTrendingProducts(PRODUCTS, 5)).slice(0, 5)))

  const under = byKey['under-999']
  assert.ok(under.type === 'product_rail')
  const legacyUnder = [...PRODUCTS].filter((p) => p.price != null && p.price > 0 && p.price < 999).sort((a, b) => (a.price || 0) - (b.price || 0))
  assert.deepEqual(ids(under.products), ids(withImage(legacyUnder).slice(0, 6)))

  const festive = byKey.festive
  assert.ok(festive.type === 'product_rail')
  const legacyFestive = withImage(
    PRODUCTS.filter((p) => p.occasion_tags.includes('festive') || p.category_name === 'Hampers & Gift Sets' || /festive|diwali|hamper/i.test(p.name)),
  ).slice(0, 4)
  assert.deepEqual(ids(festive.products), ids(legacyFestive))
  assert.equal(festive.content.dark, true)

  const packaging = byKey.packaging
  assert.ok(packaging.type === 'packaging')
  const legacyShots = PRODUCTS.filter(
    (p) => p.image_url && !legacyFestive.some((f) => f.id === p.id) && /gift box|hamper|gift set|basket|crate|box/i.test(p.name) && !/badge|lanyard|holder/i.test(p.name),
  ).slice(0, 2)
  assert.deepEqual(packaging.photos.map((photo) => photo.key), ids(legacyShots))

  const occasions = byKey.occasions
  assert.ok(occasions.type === 'occasion_grid')
  assert.deepEqual(occasions.cards.map((card) => card.card.collectionSlug), ['festival-gifting', 'welcome-kits', 'client-appreciation', 'new-joiner-essentials', 'conference-and-events', 'executive-edit'])
  for (const card of occasions.cards) assert.deepEqual(ids(card.items), ids(PRODUCTS.filter(LEGACY_MATCH[card.card.collectionSlug])), card.card.collectionSlug)
})

test('homepage: an unpublished, store-hidden or out-of-window collection empties its section', () => {
  for (const change of [{ status: 'draft' as const }, { showInStore: false }, { schedule: { endsOn: '2026-10-01' } }]) {
    const collections = DEFAULT_COLLECTIONS.map((c) => (c.slug === 'under-999' ? { ...c, ...change } : c))
    const under = resolveHomepage(DEFAULT_HOMEPAGE, collections, PRODUCTS, { date: TODAY }).find((s) => s.key === 'under-999')!
    assert.ok(under.type === 'product_rail')
    assert.equal(under.products.length, 0)
  }
  const drafts = DEFAULT_COLLECTIONS.map((c) => (c.slug === 'under-999' ? { ...c, status: 'draft' as const } : c))
  const preview = resolveHomepage(DEFAULT_HOMEPAGE, drafts, PRODUCTS, { date: TODAY, includeDraftCollections: true }).find((s) => s.key === 'under-999')!
  assert.ok(preview.type === 'product_rail' && preview.products.length === 6)
})

test('manual collections keep their order; rule collections put pinned products first', () => {
  const [a, b, c] = PRODUCTS
  const manual = collectionProducts(PRODUCTS, { source: 'manual', rule: {}, sort: 'price_desc', productIds: [c.id, 'missing', a.id] })
  assert.deepEqual(ids(manual), [c.id, a.id])
  const pinned = collectionProducts(PRODUCTS, { source: 'rule', rule: { any: [{ field: 'category', in: ['Watches'] }] }, sort: 'catalogue', productIds: [b.id] })
  assert.equal(pinned[0].id, b.id)
  assert.ok(pinned.slice(1).every((p) => p.category_name === 'Watches'))
  assert.equal(matchRule(a, {}), false)
})

test('seed file is generated from the defaults and parses back to them', () => {
  assert.equal(readFileSync('supabase/migrations/20261022_homepage_cms_seed.sql', 'utf8'), homepageSeedSql())
  for (const section of DEFAULT_SECTIONS) {
    const parsed = normalizeSectionContent(section.type, JSON.parse(JSON.stringify(section.content)))
    assert.deepEqual(parsed, section.content, section.key)
  }
  for (const collection of DEFAULT_COLLECTIONS) {
    const row = collectionFromRow({
      id: 'id', slug: collection.slug, title: collection.title, kicker: collection.kicker, description: collection.description,
      image_url: null, source: collection.source, rule: JSON.parse(JSON.stringify(collection.rule)), sort: collection.sort,
      status: collection.status, show_in_store: true, show_in_business: true, listed: collection.listed, starts_on: null,
      ends_on: null, repeat_yearly: false, position: collection.position, collection_products: [],
    })
    assert.deepEqual({ ...row, id: undefined }, { ...collection, id: undefined }, collection.slug)
  }
})

test('heading accents', () => {
  assert.deepEqual(headingParts('Thoughtful gifting, *handcrafted* to be cherished.'), [
    { text: 'Thoughtful gifting, ', accent: false },
    { text: 'handcrafted', accent: true },
    { text: ' to be cherished.', accent: false },
  ])
  assert.equal(plainHeading('Every Gift, an Unforgettable *Unboxing Experience*.'), 'Every Gift, an Unforgettable Unboxing Experience.')
  assert.deepEqual(headingParts('5 * 3'), [{ text: '5 * 3', accent: false }])
})
