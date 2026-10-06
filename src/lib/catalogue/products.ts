import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'
import { offersByProduct } from '@/lib/pricing/offers'
import { resolveSellPrice } from '@/lib/pricing/resolve'
import { getPricingSettings, loadSupplierOffers, supplierCostForProduct } from '@/lib/pricing/server'
import { purchaseOffer, type PurchaseOffer } from '@/lib/catalogue/purchase-path'
import type { SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_PRODUCT_SELECT =
  'id, name, sku, description, image_url, price, moq, supplier_cost, internal_margin, category_id, brand_id, status, created_at, category:categories(id, name), brand:brands(id, name)' as const
const PUBLIC_PRODUCT_SELECT_WITH_PURCHASE =
  'id, name, sku, description, image_url, price, moq, supplier_cost, internal_margin, category_id, brand_id, status, created_at, stock_qty, fulfillment_mode, category:categories(id, name), brand:brands(id, name)' as const

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
  status: string
  created_at: string | null
  purchase: PurchaseOffer
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
    category?: Named | Named[] | null
    brand?: Named | Named[] | null
  },
  sellPrice: number | null
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
    status: row.status,
    created_at: row.created_at || null,
    purchase: purchaseOffer({
      fulfillmentMode: row.fulfillment_mode,
      stockQty: row.stock_qty,
      hasSellPrice: sellPrice != null && Number.isFinite(Number(sellPrice)),
    }),
  }
}

function missingPurchaseColumn(message: string | undefined) {
  return Boolean(message && /stock_qty|fulfillment_mode/i.test(message))
}

type PublicRow = Parameters<typeof toPublicProduct>[0] & {
  supplier_cost?: number | null
  internal_margin?: number | null
}

async function loadPublicRows(client: SupabaseClient, id?: string): Promise<PublicRow[]> {
  if (id) {
    const single = await client
      .from('products')
      .select(PUBLIC_PRODUCT_SELECT_WITH_PURCHASE)
      .eq('status', 'active')
      .eq('catalogue_access', 'all')
      .eq('id', id)
      .maybeSingle()
    if (single.error && missingPurchaseColumn(single.error.message)) {
      const fallback = await client
        .from('products')
        .select(PUBLIC_PRODUCT_SELECT)
        .eq('status', 'active')
        .eq('catalogue_access', 'all')
        .eq('id', id)
        .maybeSingle()
      return fallback.data ? [fallback.data as unknown as PublicRow] : []
    }
    return single.data ? [single.data as unknown as PublicRow] : []
  }

  const first = await client
    .from('products')
    .select(PUBLIC_PRODUCT_SELECT_WITH_PURCHASE)
    .eq('status', 'active')
    .eq('catalogue_access', 'all')
    .order('name')
  if (first.error && missingPurchaseColumn(first.error.message)) {
    const fallback = await client
      .from('products')
      .select(PUBLIC_PRODUCT_SELECT)
      .eq('status', 'active')
      .eq('catalogue_access', 'all')
      .order('name')
    return (fallback.data || []) as unknown as PublicRow[]
  }
  if (first.error || !first.data) return []
  return first.data as unknown as PublicRow[]
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

export async function getPublicCatalogueProducts(): Promise<PublicProduct[]> {
  try {
    const client = await publicDbClient()
    if (!client) return []
    const data = await loadPublicRows(client)
    if (!data.length) return []
    const settings = await getPricingSettings()
    if (!settings.surfaces.store.showSellPrice) {
      return data.map((row) => toPublicProduct(row, null))
    }
    const offers = settings.surfaces.store.useBestCost
      ? offersByProduct(await loadSupplierOffers(client, data.map((row) => row.id)))
      : new Map()
    return data.map((row) => {
      const resolved = resolveSellPrice({
        supplierCost: supplierCostForProduct(row, offers.get(row.id) || [], {
          useBestCost: settings.surfaces.store.useBestCost,
          requireInStock: settings.requireInStock,
          quantity: row.moq,
        }),
        listPrice: row.price,
        productMarginPercent: row.internal_margin,
        channel: 'b2c',
        settings,
      })
      return toPublicProduct(row, resolved.sellPrice)
    })
  } catch {
    return []
  }
}

export async function getPublicProduct(id: string): Promise<PublicProduct | null> {
  try {
    const client = await publicDbClient()
    if (!client) return null
    const data = (await loadPublicRows(client, id))[0]
    if (!data) return null
    const settings = await getPricingSettings()
    if (!settings.surfaces.store.showSellPrice) return toPublicProduct(data, null)
    const offers = settings.surfaces.store.useBestCost
      ? await loadSupplierOffers(client, [data.id])
      : []
    const resolved = resolveSellPrice({
      supplierCost: supplierCostForProduct(data, offers, {
        useBestCost: settings.surfaces.store.useBestCost,
        requireInStock: settings.requireInStock,
        quantity: data.moq,
      }),
      listPrice: data.price,
      productMarginPercent: data.internal_margin,
      channel: 'b2c',
      settings,
    })
    return toPublicProduct(data, resolved.sellPrice)
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
  ).map(([id, name]) => ({ id, name }))
  return unique.sort((a, b) => a.name.localeCompare(b.name))
}

export function sanitiseCatalogueSearch(value: string) {
  return value.replace(/[,()*]/g, ' ').trim().slice(0, 80)
}
