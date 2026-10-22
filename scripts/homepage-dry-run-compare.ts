/**
 * Compares the homepage dry run (supabase/tests/homepage_cms_check.sql) with the built-in homepage.
 *
 *   npx tsx scripts/homepage-dry-run-compare.ts <dryrun-md5.json> <products.json> [rendered.json]
 *
 * dryrun-md5.json  section_md5 and collection_md5 from the DRYRUN_RESULT message
 * products.json    store products (id, name, description, image_url, price = store price,
 *                  category_name, occasion_tags, created_at) in catalogue (name) order
 * rendered.json    optional per-section capture of the live page (links and images) to
 *                  compare the resolved products with what the store shows today
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DEFAULT_COLLECTIONS, DEFAULT_HOMEPAGE, DEFAULT_SECTIONS } from '../src/lib/homepage/defaults'
import { resolveHomepage } from '../src/lib/homepage/resolve'
import { occasionTagList } from '../src/lib/catalogue/storefront'
import type { PublicProduct } from '../src/lib/catalogue/products'

/** Postgres jsonb text output: keys by byte length then bytes, ", " and ": " separators. */
function jsonbText(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).filter((key) => (value as Record<string, unknown>)[key] !== undefined)
    keys.sort((a, b) => {
      const ab = Buffer.from(a)
      const bb = Buffer.from(b)
      return ab.length - bb.length || Buffer.compare(ab, bb)
    })
    return `{${keys.map((key) => `${JSON.stringify(key)}: ${jsonbText((value as Record<string, unknown>)[key])}`).join(', ')}}`
  }
  return JSON.stringify(value)
}
const md5 = (text: string) => createHash('md5').update(text).digest('hex')

const [md5File, productsFile, renderedFile] = process.argv.slice(2)
const dry = JSON.parse(readFileSync(md5File, 'utf8')) as { section_md5: Record<string, string>; collection_md5: Record<string, string> }
let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failures += 1
  console.log(`${ok ? 'SAME' : 'DIFF'}  ${label}${detail ? `  ${detail}` : ''}`)
}

console.log('# Seeded rows vs built-in content (md5 of jsonb text)')
for (const section of DEFAULT_SECTIONS) check(`section ${section.key}`, dry.section_md5[section.key] === md5(jsonbText(section.content)))
check('section count', Object.keys(dry.section_md5).length === DEFAULT_SECTIONS.length)
for (const collection of DEFAULT_COLLECTIONS) {
  const row = {
    slug: collection.slug, title: collection.title, kicker: collection.kicker, description: collection.description,
    image_url: collection.imageUrl ?? null, source: collection.source, rule: collection.rule, sort: collection.sort,
    status: collection.status, show_in_store: collection.showInStore, show_in_business: collection.showInBusiness,
    listed: collection.listed, starts_on: collection.schedule?.startsOn ?? null, ends_on: collection.schedule?.endsOn ?? null,
    repeat_yearly: Boolean(collection.schedule?.repeatYearly), position: collection.position,
  }
  check(`collection ${collection.slug}`, dry.collection_md5[collection.slug] === md5(jsonbText(row)))
}
check('collection count', Object.keys(dry.collection_md5).length === DEFAULT_COLLECTIONS.length)

type Raw = { id: string; name: string; sku: string; description: string | null; image_url: string | null; price: number | string | null; category_name: string | null; brand_id: string | null; brand_name: string | null; occasion_tags: unknown; created_at: string | null }
const products: PublicProduct[] = (JSON.parse(readFileSync(productsFile, 'utf8')) as Raw[]).map((row) => ({
  id: row.id, name: row.name, sku: row.sku, description: row.description, image_url: row.image_url,
  price: row.price == null ? null : Number(row.price), moq: null, category_id: null, category_name: row.category_name,
  brand_id: row.brand_id, brand_name: row.brand_name, brand_logo_url: null, occasion_tags: occasionTagList(row.occasion_tags),
  status: 'active', created_at: row.created_at, purchase: {} as PublicProduct['purchase'],
}))

const resolved = resolveHomepage(DEFAULT_HOMEPAGE, DEFAULT_COLLECTIONS, products, { date: '2026-10-22' })
console.log(`\n# Sections resolved from the seeded config (${products.length} store products)`)
const productIds = new Map<string, string[]>()
for (const section of resolved) {
  let ids: string[] = []
  if (section.type === 'hero') ids = section.slides.flat().map((product) => product.id)
  if (section.type === 'product_rail') ids = section.products.map((product) => product.id)
  if (section.type === 'packaging') ids = section.photos.map((photo) => photo.key)
  if (section.type === 'occasion_grid') ids = section.cards.map((card) => `${card.card.collectionSlug}:${card.items.length}`)
  productIds.set(section.key, ids)
  console.log(`${section.key.padEnd(12)} ${section.type.padEnd(15)} ${ids.length} -> ${ids.join(' ')}`)
}

if (renderedFile) {
  console.log('\n# Resolved vs the page the store renders today')
  const rendered = JSON.parse(readFileSync(renderedFile, 'utf8')) as { headings: string[]; links: string[]; images: string[] }[]
  const uuid = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/
  const fromLinks = (links: string[]) => [...new Set(links.filter((link) => link.startsWith('/catalogue/')).map((link) => link.match(uuid)?.[1]).filter(Boolean) as string[])]
  const fromImages = (images: string[]) => images.map((image) => image.match(/product-images\/([0-9a-f-]{36})\//)?.[1]).filter(Boolean) as string[]
  resolved.forEach((section, index) => {
    const page = rendered[index]
    if (!page) return check(section.key, false, 'missing on page')
    if (section.type === 'hero' || section.type === 'product_rail') {
      const ids = productIds.get(section.key) || []
      check(`${section.key} products`, JSON.stringify(fromLinks(page.links)) === JSON.stringify(ids), `${ids.length} products`)
    }
    if (section.type === 'packaging') {
      const ids = productIds.get(section.key) || []
      check(`${section.key} photos`, JSON.stringify(fromImages(page.images)) === JSON.stringify(ids), `${ids.length} photos`)
      const titles = section.content.tiles.map((tile) => tile.title)
      check(`${section.key} tiles`, titles.every((title) => page.headings.includes(title)), titles.join(' | '))
    }
    if (section.type === 'occasion_grid') {
      const hrefs = section.cards.map((card) => card.card.href)
      check(`${section.key} cards`, JSON.stringify(page.links.filter((link) => link !== '/collections')) === JSON.stringify(hrefs), hrefs.join(' '))
      const fromPrices = section.cards.map((card) => {
        const prices = card.items.map((product) => product.price).filter((price): price is number => price != null && price > 0)
        return prices.length ? Math.min(...prices) : null
      })
      const shown = page.headings.filter((text) => text.startsWith('From ')).map((text) => Number(text.replace(/[^0-9.]/g, '')))
      const expected = fromPrices.filter((price): price is number => price != null).map((price) => Math.round(price))
      check(`${section.key} From prices`, JSON.stringify(shown) === JSON.stringify(expected), `page ${shown.join(', ')} / resolved ${expected.join(', ')}`)
    }
    // The capture keeps leaf elements only, so a heading with an accent span is checked by its
    // accent words here; the full heading is covered by the pixel comparison.
    const heading = section.content.heading.replace(/\*/g, '')
    const accents = section.content.heading.match(/\*([^*]+)\*/g)?.map((part) => part.slice(1, -1)) || []
    check(
      `${section.key} heading`,
      accents.length ? accents.every((part) => page.headings.includes(part)) : page.headings.includes(heading),
      accents.length ? `${heading} (accent words)` : heading,
    )
    if (section.content.eyebrow) check(`${section.key} eyebrow`, page.headings.includes(section.content.eyebrow), section.content.eyebrow)
  })
}

console.log(failures ? `\n${failures} difference(s)` : '\nAll checks SAME')
process.exit(failures ? 1 : 0)
