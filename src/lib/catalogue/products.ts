import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { gstPriceNote } from '@/lib/pricing/engine'
import { readProductCost } from '@/lib/pricing/product-costs'
import { getPricingSettings, resolveListedPrices } from '@/lib/pricing/server'
import { type PurchaseOffer } from '@/lib/catalogue/purchase-path'
import { retailCartOffer, visibleOnRetailStore } from '@/lib/catalogue/availability'
import { occasionTagList, storefrontSampleOffer } from '@/lib/catalogue/storefront'
import { cachedPublicRead } from '@/lib/catalogue/public-read'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CHANNEL_COLUMN, channelColumnsMissing, type Channel } from '@/lib/products/channel-visibility'

const CATEGORY_EMBED = 'category:categories(id, name)'
const BRAND_EMBED = 'brand:brands(id, name)'
const BRAND_LOGO_EMBED = 'brand:brands(id, name, logo_url)'
const PUBLIC_COST_EMBED = 'product_costs(supplier_cost)'
const FULL_CATALOGUE_SELECT =
  `id, name, sku, description, image_url, price, moq, category_id, brand_id, status, created_at, stock_qty, fulfillment_mode, sample_only, occasion_tags, ${CATEGORY_EMBED}, ${BRAND_LOGO_EMBED}, ${PUBLIC_COST_EMBED}`
const SUGGESTION_SELECT = `id, name, image_url, ${CATEGORY_EMBED}`
const NAV_CATEGORY_SELECT = `category_id, ${CATEGORY_EMBED}`
const SUGGESTION_LIMIT = 40

export type PublicProduct = {
  id: string
  name: string
  sku: string
  description: string | null
  image_url: string | null
  price: number | null
  moq: number | null
  category_id: string | null
  category_name: string | null
  brand_id: string | null
  brand_name: string | null
  brand_logo_url: string | null
  occasion_tags: string[]
  status: string
  created_at: string | null
  purchase: PurchaseOffer
  priceNote?: string | null
}

export type StoreSearchSuggestion = {
  id: string
  name: string
  category_name: string | null
  image_url: string | null
  href: string
}

type Named = { id: string; name: string; logo_url?: string | null }
type QueryError = { message: string }

type PublicRow = {
  id: string
  name: string
  sku: string
  description: string | null
  image_url: string | null
  price: number | null
  moq: number | null
  category_id: string | null
  brand_id?: string | null
  status: string
  created_at?: string | null
  stock_qty?: number | null
  fulfillment_mode?: string | null
  sample_only?: boolean | null
  occasion_tags?: unknown
  supplier_cost?: number | null
  category?: Named | Named[] | null
  brand?: Named | Named[] | null
  product_costs?: unknown
}

function logoOf(brand: Named | Named[] | null | undefined) {
  const logo = oneRelation(brand)?.logo_url
  if (typeof logo !== 'string') return null
  const trimmed = logo.trim()
  return trimmed || null
}

function toPublicProduct(row: PublicRow, sellPrice: number | null, priceNote: string | null | undefined, channel: Channel): PublicProduct {
  const hasSellPrice = sellPrice != null && Number.isFinite(Number(sellPrice))
  const purchase = channel === 'store'
    ? retailCartOffer({
        fulfillmentMode: row.fulfillment_mode,
        stockQty: row.stock_qty,
        hasSellPrice,
        sampleOnly: Boolean(row.sample_only),
      })
    : storefrontSampleOffer({
        fulfillmentMode: row.fulfillment_mode,
        stockQty: row.stock_qty,
        hasSellPrice,
        sampleOnly: Boolean(row.sample_only),
      })
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    image_url: row.image_url,
    price: sellPrice,
    moq: row.moq,
    category_id: row.category_id,
    category_name: oneRelation(row.category)?.name || null,
    brand_id: row.brand_id || null,
    brand_name: oneRelation(row.brand)?.name || null,
    brand_logo_url: logoOf(row.brand),
    occasion_tags: occasionTagList(row.occasion_tags),
    status: row.status,
    created_at: row.created_at || null,
    purchase,
    priceNote: priceNote || null,
  }
}

function attachCosts(rows: unknown[]): PublicRow[] {
  return rows.map((row) => {
    const record = row as PublicRow
    return { ...record, ...readProductCost(record as Parameters<typeof readProductCost>[0]) }
  })
}

function asRows(data: unknown): unknown[] {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

function narrowSelect(select: string, message: string) {
  if (/logo_url/i.test(message) && select.includes(BRAND_LOGO_EMBED)) {
    return select.replace(BRAND_LOGO_EMBED, BRAND_EMBED)
  }
  if (/occasion_tags/i.test(message) && select.includes('occasion_tags')) {
    return select.replace(', occasion_tags', '')
  }
  if (/sample_only/i.test(message) && select.includes('sample_only')) {
    return select.replace(', sample_only', '')
  }
  if (/stock_qty|fulfillment_mode/i.test(message) && /stock_qty|fulfillment_mode/.test(select)) {
    return select
      .replace(', stock_qty, fulfillment_mode, sample_only', '')
      .replace(', stock_qty, fulfillment_mode', '')
      .replace(', sample_only', '')
  }
  if (/product_costs/i.test(message) && select.includes(PUBLIC_COST_EMBED)) {
    return select.replace(`, ${PUBLIC_COST_EMBED}`, '')
  }
  return null
}

async function selectActive(
  client: SupabaseClient,
  select: string,
  column: string,
  value: string | boolean,
  options?: { id?: string; limit?: number },
): Promise<{ data: unknown; error: QueryError | null }> {
  let query = client.from('products').select(select).eq('status', 'active').eq(column, value)
  if (options?.id) {
    const single = await query.eq('id', options.id).maybeSingle()
    return { data: single.data, error: single.error ? { message: single.error.message } : null }
  }
  query = query.order('name')
  if (options?.limit) query = query.limit(options.limit)
  const list = await query
  return { data: list.data, error: list.error ? { message: list.error.message } : null }
}

async function selectOnChannel(
  client: SupabaseClient,
  select: string,
  channel: Channel,
  options?: { limit?: number },
) {
  let column: string = CHANNEL_COLUMN[channel]
  let value: string | boolean = true
  let result = await selectActive(client, select, column, value, options)
  if (result.error && channelColumnsMissing(result.error.message)) {
    column = 'catalogue_access'
    value = 'all'
    result = await selectActive(client, select, column, value, options)
  }
  return result
}

/**
 * Active products for one channel. One query when the live columns exist.
 * Older databases retry without the column the error names, instead of probing first.
 */
export async function loadPublicRows(client: SupabaseClient, channel: Channel = 'store'): Promise<PublicRow[]> {
  let select = FULL_CATALOGUE_SELECT
  let column: string = CHANNEL_COLUMN[channel]
  let value: string | boolean = true
  let switchedChannel = false
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await selectActive(client, select, column, value)
    if (!result.error) return attachCosts(asRows(result.data))
    if (!switchedChannel && channelColumnsMissing(result.error.message)) {
      column = 'catalogue_access'
      value = 'all'
      switchedChannel = true
      continue
    }
    const next = narrowSelect(select, result.error.message)
    if (!next || next === select) throw new Error(result.error.message)
    select = next
  }
  throw new Error('Could not read the public catalogue')
}

/** First 40 store products by name: the header search only shows these. */
export async function readSearchSuggestions(client: SupabaseClient, limit = SUGGESTION_LIMIT): Promise<StoreSearchSuggestion[]> {
  const result = await selectOnChannel(client, SUGGESTION_SELECT, 'store', { limit })
  if (result.error) throw new Error(result.error.message)
  return asRows(result.data).map((row) => {
    const product = row as PublicRow
    return {
      id: product.id,
      name: product.name,
      category_name: oneRelation(product.category)?.name || null,
      image_url: product.image_url || null,
      href: `/catalogue/${product.id}`,
    }
  })
}

/** Categories that have an active store product, without loading prices or descriptions. */
export async function readNavCategories(client: SupabaseClient) {
  const result = await selectOnChannel(client, NAV_CATEGORY_SELECT, 'store')
  if (result.error) throw new Error(result.error.message)
  const unique = new Map<string, { id: string; name: string }>()
  for (const row of asRows(result.data) as PublicRow[]) {
    const category = oneRelation(row.category)
    const id = row.category_id || category?.id || null
    const name = category?.name || null
    if (!id || !name) continue
    unique.set(id, { id, name })
  }
  return sortProductCategories([...unique.values()])
}

async function publicDbClient(): Promise<SupabaseClient | null> {
  const admin = createAdminClient()
  if (admin) return admin
  try {
    return await createClient()
  } catch {
    return null
  }
}

async function assembleCatalogue(client: SupabaseClient, channel: Channel): Promise<PublicProduct[]> {
  const loaded = await loadPublicRows(client, channel)
  const data = channel === 'store' ? visibleOnRetailStore(loaded) : loaded
  if (!data.length) return []
  const settings = await getPricingSettings()
  const rule = settings.portals.store
  const note = settings.surfaces.store.showSellPrice ? gstPriceNote(rule.gstMode) : null
  const resolved = settings.surfaces.store.showSellPrice
    ? await resolveListedPrices(data.map((row) => ({ id: row.id })), 'store', null, null, settings, client)
    : null
  if (!settings.surfaces.store.showSellPrice) return data.map((row) => toPublicProduct(row, null, null, channel))
  return data.map((row) => toPublicProduct(row, resolved?.get(row.id)?.price ?? null, note, channel))
}

const readCachedCatalogue = cachedPublicRead('priced-catalogue', async (channel: Channel) => {
  const client = createAdminClient()
  if (!client) throw new Error('missing service role')
  return assembleCatalogue(client, channel)
})

const readCachedSuggestions = cachedPublicRead('search-suggestions', async () => {
  const client = createAdminClient()
  if (!client) throw new Error('missing service role')
  return readSearchSuggestions(client)
})

const readCachedNavCategories = cachedPublicRead('nav-categories', async () => {
  const client = createAdminClient()
  if (!client) throw new Error('missing service role')
  return readNavCategories(client)
})

const PREVIEW_IN_STOCK = '33333333-3333-4333-8333-333333333333'
const PREVIEW_OUT_OF_STOCK = '44444444-4444-4444-8444-444444444444'

function previewCatalogue(): PublicProduct[] | null {
  if (process.env.STOREFRONT_UI_PREVIEW !== '1') return null
  return [PREVIEW_IN_STOCK, PREVIEW_OUT_OF_STOCK].flatMap((id) => {
    const product = previewPublicProduct(id)
    return product ? [product] : []
  })
}

/** Active products switched on for the retail store (default) or the business portal. */
export const getPublicCatalogueProducts = cache(async (channel: Channel = 'store'): Promise<PublicProduct[]> => {
  if (channel === 'store') {
    const preview = previewCatalogue()
    if (preview) return preview
  }
  try {
    if (createAdminClient()) return await readCachedCatalogue(channel)
    const client = await publicDbClient()
    if (!client) return []
    return await assembleCatalogue(client, channel)
  } catch {
    return []
  }
})

export const getPublicSearchSuggestions = cache(async (): Promise<StoreSearchSuggestion[]> => {
  try {
    if (createAdminClient()) return await readCachedSuggestions()
    const client = await publicDbClient()
    if (!client) return []
    return await readSearchSuggestions(client)
  } catch {
    return []
  }
})

export const getPublicNavCategories = cache(async () => {
  try {
    if (createAdminClient()) return await readCachedNavCategories()
    const client = await publicDbClient()
    if (!client) return []
    return await readNavCategories(client)
  } catch {
    return []
  }
})

function previewPublicProduct(id: string): PublicProduct | null {
  if (process.env.STOREFRONT_UI_PREVIEW !== '1') return null
  const stock = id === '33333333-3333-4333-8333-333333333333' ? 4 : id === '44444444-4444-4444-8444-444444444444' ? 0 : null
  if (stock == null) return null
  return {
    id,
    name: stock ? 'Steel bottle' : 'Desk diary',
    sku: stock ? 'BTL-1' : 'DRY-1',
    description: 'Preview catalogue product.',
    image_url: '/site/home-welcome-kit.webp',
    price: 450,
    moq: 25,
    category_id: 'c2',
    category_name: stock ? 'Drinkware' : 'Desk & Stationery',
    brand_id: '11111111-1111-4111-8111-111111111111',
    brand_name: 'Souvenir',
    brand_logo_url: '/logo.png',
    occasion_tags: ['welcome'],
    status: 'active',
    created_at: null,
    purchase: retailCartOffer({
      fulfillmentMode: 'auto',
      stockQty: stock,
      hasSellPrice: true,
    }),
  }
}

export const getPublicProduct = cache(async (id: string): Promise<PublicProduct | null> => {
  const preview = previewPublicProduct(id)
  if (preview) return preview
  const products = await getPublicCatalogueProducts()
  return products.find((product) => product.id === id) || null
})

export async function getPublicCategories() {
  const products = await getPublicCatalogueProducts()
  const unique = Array.from(
    new Map(
      products
        .filter((product) => product.category_id && product.category_name)
        .map((product) => [product.category_id as string, product.category_name as string])
    ).entries()
  ).map(([id, name]) => ({ id, name }))
  return sortProductCategories(unique)
}

export async function getPublicBrands() {
  const products = await getPublicCatalogueProducts()
  const unique = Array.from(
    new Map(
      products
        .filter((product) => product.brand_id && product.brand_name)
        .map((product) => [product.brand_id as string, product.brand_name as string])
    ).entries()
  ).map(([id, name]) => ({
    id,
    name,
    logo_url: products.find((product) => product.brand_id === id)?.brand_logo_url || null,
  }))
  return unique.sort((a, b) => a.name.localeCompare(b.name))
}

export function sanitiseCatalogueSearch(value: string) {
  return value.replace(/[,()*]/g, ' ').trim().slice(0, 80)
}
