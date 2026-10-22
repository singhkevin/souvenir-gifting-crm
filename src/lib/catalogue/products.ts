import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { gstPriceNote } from '@/lib/pricing/engine'
import { readProductCost } from '@/lib/pricing/product-costs'
import { getPricingSettings, resolveListedPrices } from '@/lib/pricing/server'
import { type PurchaseOffer } from '@/lib/catalogue/purchase-path'
import { occasionTagList, storefrontSampleOffer } from '@/lib/catalogue/storefront'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CHANNEL_COLUMN, channelColumnsMissing, type Channel } from '@/lib/products/channel-visibility'

const PUBLIC_PRODUCT_SELECT =
  'id, name, sku, description, image_url, price, moq, category_id, brand_id, status, created_at, category:categories(id, name), brand:brands(id, name)' as const
const PUBLIC_PRODUCT_SELECT_WITH_PURCHASE =
  'id, name, sku, description, image_url, price, moq, category_id, brand_id, status, created_at, stock_qty, fulfillment_mode, sample_only, category:categories(id, name), brand:brands(id, name)' as const
const PUBLIC_COST_EMBED = 'product_costs(supplier_cost)'

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

type Named = { id: string; name: string }

function toPublicProduct(
  row: {
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
    category?: Named | Named[] | null
    brand?: Named | Named[] | null
  },
  sellPrice: number | null,
  priceNote?: string | null,
): PublicProduct {
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
    brand_logo_url: null,
    occasion_tags: [],
    status: row.status,
    created_at: row.created_at || null,
    purchase: storefrontSampleOffer({
      fulfillmentMode: row.fulfillment_mode,
      stockQty: row.stock_qty,
      hasSellPrice: sellPrice != null && Number.isFinite(Number(sellPrice)),
      sampleOnly: Boolean(row.sample_only),
    }),
    priceNote: priceNote || null,
  }
}

function missingPurchaseColumn(message: string | undefined) {
  return Boolean(message && /stock_qty|fulfillment_mode/i.test(message))
}

type PublicRow = Parameters<typeof toPublicProduct>[0] & {
  supplier_cost?: number | null
}

function attachCosts(rows: unknown[]): PublicRow[] {
  return rows.map((row) => {
    const record = row as PublicRow & { product_costs?: unknown }
    return { ...record, ...readProductCost(record as Parameters<typeof readProductCost>[0]) }
  })
}

/**
 * Store and business portal read their own channel switch. Until
 * 20261022_channel_visibility.sql is applied the columns do not exist and both
 * channels keep the legacy rule (catalogue_access = 'all').
 */
async function channelFilter(client: SupabaseClient, channel: Channel): Promise<[string, string | boolean]> {
  const probe = await client.from('products').select('show_in_store, show_in_business').limit(1)
  if (probe.error && channelColumnsMissing(probe.error.message)) return ['catalogue_access', 'all']
  return [CHANNEL_COLUMN[channel], true]
}

async function loadPublicRows(client: SupabaseClient, id?: string, channel: Channel = 'store'): Promise<PublicRow[]> {
  const [channelColumn, channelValue] = await channelFilter(client, channel)
  const probe = await client.from('products').select('sample_only').limit(1)
  const purchaseColumns = probe.error && /sample_only/i.test(probe.error.message)
    ? PUBLIC_PRODUCT_SELECT_WITH_PURCHASE.replace(', sample_only', '')
    : PUBLIC_PRODUCT_SELECT_WITH_PURCHASE
  const purchaseSelect = `${purchaseColumns}, ${PUBLIC_COST_EMBED}`
  const plainSelect = `${PUBLIC_PRODUCT_SELECT}, ${PUBLIC_COST_EMBED}`
  if (id) {
    const single = await client
      .from('products')
      .select(purchaseSelect)
      .eq('status', 'active')
      .eq(channelColumn, channelValue)
      .eq('id', id)
      .maybeSingle()
    if (single.error && /product_costs/i.test(single.error.message)) {
      const withoutCost = await client
        .from('products')
        .select(purchaseColumns)
        .eq('status', 'active')
        .eq(channelColumn, channelValue)
        .eq('id', id)
        .maybeSingle()
      if (withoutCost.error && missingPurchaseColumn(withoutCost.error.message)) {
        const fallback = await client
          .from('products')
          .select(PUBLIC_PRODUCT_SELECT)
          .eq('status', 'active')
          .eq(channelColumn, channelValue)
          .eq('id', id)
          .maybeSingle()
        return fallback.data ? attachCosts([fallback.data]) : []
      }
      return withoutCost.data ? attachCosts([withoutCost.data]) : []
    }
    if (single.error && missingPurchaseColumn(single.error.message)) {
      const fallback = await client
        .from('products')
        .select(plainSelect)
        .eq('status', 'active')
        .eq(channelColumn, channelValue)
        .eq('id', id)
        .maybeSingle()
      if (fallback.error && /product_costs/i.test(fallback.error.message)) {
        const plain = await client
          .from('products')
          .select(PUBLIC_PRODUCT_SELECT)
          .eq('status', 'active')
          .eq(channelColumn, channelValue)
          .eq('id', id)
          .maybeSingle()
        return plain.data ? attachCosts([plain.data]) : []
      }
      return fallback.data ? attachCosts([fallback.data]) : []
    }
    return single.data ? attachCosts([single.data]) : []
  }

  const first = await client
    .from('products')
    .select(purchaseSelect)
    .eq('status', 'active')
    .eq(channelColumn, channelValue)
    .order('name')
  if (first.error && /product_costs/i.test(first.error.message)) {
    const withoutCost = await client
      .from('products')
      .select(purchaseColumns)
      .eq('status', 'active')
      .eq(channelColumn, channelValue)
      .order('name')
    if (withoutCost.error && missingPurchaseColumn(withoutCost.error.message)) {
      const fallback = await client
        .from('products')
        .select(PUBLIC_PRODUCT_SELECT)
        .eq('status', 'active')
        .eq(channelColumn, channelValue)
        .order('name')
      return attachCosts(fallback.data || [])
    }
    return attachCosts(withoutCost.data || [])
  }
  if (first.error && missingPurchaseColumn(first.error.message)) {
    const fallback = await client
      .from('products')
      .select(plainSelect)
      .eq('status', 'active')
      .eq(channelColumn, channelValue)
      .order('name')
    if (fallback.error && /product_costs/i.test(fallback.error.message)) {
      const plain = await client
        .from('products')
        .select(PUBLIC_PRODUCT_SELECT)
        .eq('status', 'active')
        .eq(channelColumn, channelValue)
        .order('name')
      return attachCosts(plain.data || [])
    }
    return attachCosts(fallback.data || [])
  }
  if (first.error || !first.data) return []
  return attachCosts(first.data)
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

async function decorateStorefront(client: SupabaseClient, products: PublicProduct[]) {
  if (!products.length) return products
  const tagged = await client.from('products').select('id, occasion_tags').in('id', products.map((product) => product.id))
  const tags = new Map<string, string[]>()
  if (!tagged.error) {
    for (const row of tagged.data || []) tags.set(row.id as string, occasionTagList(row.occasion_tags))
  }
  const logos = await client.from('brands').select('id, logo_url')
  const logo = new Map<string, string | null>()
  if (!logos.error) {
    for (const row of logos.data || []) logo.set(row.id as string, (row.logo_url as string | null) || null)
  }
  return products.map((product) => ({
    ...product,
    occasion_tags: tags.get(product.id) || [],
    brand_logo_url: product.brand_id ? logo.get(product.brand_id) || null : null,
  }))
}

/** Active products switched on for the retail store (default) or the business portal. */
export async function getPublicCatalogueProducts(channel: Channel = 'store'): Promise<PublicProduct[]> {
  try {
    const client = await publicDbClient()
    if (!client) return []
    const data = await loadPublicRows(client, undefined, channel)
    if (!data.length) return []
    const settings = await getPricingSettings()
    const rule = settings.portals.store
    const note = settings.surfaces.store.showSellPrice ? gstPriceNote(rule.gstMode) : null
    // Store (Retail) price: fixed price, else effective cost + product margin or store margin.
    const resolved = settings.surfaces.store.showSellPrice
      ? await resolveListedPrices(data.map((row) => ({ id: row.id })), 'store', null, null, settings, client)
      : null
    const priced = !settings.surfaces.store.showSellPrice
      ? data.map((row) => toPublicProduct(row, null))
      : data.map((row) => toPublicProduct(row, resolved?.get(row.id)?.price ?? null, note))
    return decorateStorefront(client, priced)
  } catch {
    return []
  }
}

function previewPublicProduct(id: string): PublicProduct | null {
  if (process.env.STOREFRONT_UI_PREVIEW !== '1') return null
  const stock = id === '33333333-3333-4333-8333-333333333333' ? 4 : id === '44444444-4444-4444-8444-444444444444' ? 0 : null
  if (stock == null) return null
  return {
    id,
    name: stock ? 'Steel bottle' : 'Desk diary',
    sku: stock ? 'BTL-1' : 'DRY-1',
    description: 'One sample from what is on hand. Larger quantities are quoted.',
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
    purchase: storefrontSampleOffer({
      fulfillmentMode: 'auto',
      stockQty: stock,
      hasSellPrice: true,
    }),
  }
}

export async function getPublicProduct(id: string): Promise<PublicProduct | null> {
  const preview = previewPublicProduct(id)
  if (preview) return preview
  try {
    const client = await publicDbClient()
    if (!client) return null
    const data = (await loadPublicRows(client, id))[0]
    if (!data) return null
    const settings = await getPricingSettings()
    if (!settings.surfaces.store.showSellPrice) {
      return (await decorateStorefront(client, [toPublicProduct(data, null)]))[0] || null
    }
    const resolved = await resolveListedPrices([{ id: data.id }], 'store', null, null, settings, client)
    const price = resolved?.get(data.id)?.price ?? null
    return (await decorateStorefront(client, [toPublicProduct(data, price, gstPriceNote(settings.portals.store.gstMode))]))[0] || null
  } catch {
    return null
  }
}

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
