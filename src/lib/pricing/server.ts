import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  resolveSellPrice,
  type MarginSettings,
  type PriceChannel,
  type ResolvedPrice,
} from '@/lib/pricing/resolve'
import { offersByProduct, pickBestOffer, type SupplierOffer } from '@/lib/pricing/offers'
import {
  pricingSettingsFromRow,
  SURFACE_SETTING_COLUMNS,
  type PriceSurface,
  type PricingSettings,
} from '@/lib/pricing/surfaces'

export type ProductPriceRow = {
  supplier_cost?: number | null
  price?: number | null
  internal_margin?: number | null
}

async function loadMarginSettings(): Promise<MarginSettings | null> {
  try {
    const admin = createAdminClient()
    const client = admin || (await createClient())
    const { data } = await client
      .from('org_settings')
      .select('default_margin_percent, b2c_margin_percent, b2b_margin_percent')
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      default_margin_percent: data.default_margin_percent == null ? null : Number(data.default_margin_percent),
      b2c_margin_percent: data.b2c_margin_percent == null ? null : Number(data.b2c_margin_percent),
      b2b_margin_percent: data.b2b_margin_percent == null ? null : Number(data.b2b_margin_percent),
    }
  } catch {
    return null
  }
}

export async function getMarginSettings(): Promise<MarginSettings | null> {
  return loadMarginSettings()
}

const OFFER_SELECT =
  'id, product_id, supplier_id, supplier_sku, cost, moq, lead_time_days, in_stock, is_active, is_preferred, supplier:suppliers(name)'

function asOffer(row: {
  id: string
  product_id: string
  supplier_id: string
  supplier_sku: string | null
  cost: number
  moq: number | null
  lead_time_days: number | null
  in_stock: boolean
  is_active: boolean
  is_preferred: boolean
  supplier?: { name?: string | null } | { name?: string | null }[] | null
}): SupplierOffer {
  const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier
  return {
    id: row.id,
    product_id: row.product_id,
    supplier_id: row.supplier_id,
    supplier_name: supplier?.name || null,
    supplier_sku: row.supplier_sku,
    cost: Number(row.cost),
    moq: row.moq && row.moq > 0 ? row.moq : 1,
    lead_time_days: row.lead_time_days,
    in_stock: Boolean(row.in_stock),
    is_active: Boolean(row.is_active),
    is_preferred: Boolean(row.is_preferred),
  }
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const margins = await loadMarginSettings()
  try {
    const admin = createAdminClient()
    const client = admin || (await createClient())
    const { data, error } = await client
      .from('org_settings')
      .select(SURFACE_SETTING_COLUMNS.join(', '))
      .limit(1)
      .maybeSingle()
    if (error || !data) return pricingSettingsFromRow(null, margins)
    return pricingSettingsFromRow(data as unknown as Record<string, unknown>, margins)
  } catch {
    return pricingSettingsFromRow(null, margins)
  }
}

export async function loadSupplierOffers(
  client: SupabaseClient,
  productIds: string[],
): Promise<SupplierOffer[]> {
  if (!productIds.length) return []
  const { data, error } = await client
    .from('product_supplier_offers')
    .select(OFFER_SELECT)
    .in('product_id', productIds)
  if (error || !data) return []
  return (data as unknown as Parameters<typeof asOffer>[0][]).map(asOffer)
}

export function supplierCostForProduct(
  product: ProductPriceRow & { id?: string; moq?: number | null },
  offers: SupplierOffer[],
  options: { useBestCost: boolean; requireInStock: boolean; quantity?: number | null },
): number | null {
  if (options.useBestCost && product.id) {
    const best = pickBestOffer(
      offers.filter((offer) => offer.product_id === product.id),
      { quantity: options.quantity ?? null, requireInStock: options.requireInStock },
    )
    if (best) return best.cost
  }
  return product.supplier_cost == null ? null : Number(product.supplier_cost)
}

export async function sellPricesForSurface(
  productIds: string[],
  surface: PriceSurface,
  companyMarginPercent: number | null,
): Promise<Map<string, number | null> | null> {
  if (!productIds.length) return new Map()
  const admin = createAdminClient()
  if (!admin) return null
  const settings = await getPricingSettings()
  const flags = settings.surfaces[surface]
  if (!flags.showSellPrice) {
    return new Map(productIds.map((id) => [id, null]))
  }
  const { data: products, error } = await admin
    .from('products')
    .select('id, price, supplier_cost, internal_margin, moq')
    .in('id', productIds)
  if (error || !products) return null
  const offers = flags.useBestCost ? await loadSupplierOffers(admin, productIds) : []
  const grouped = offersByProduct(offers)
  const prices = new Map<string, number | null>()
  for (const product of products) {
    const cost = supplierCostForProduct(product, grouped.get(product.id) || [], {
      useBestCost: flags.useBestCost,
      requireInStock: settings.requireInStock,
      quantity: product.moq,
    })
    const resolved = resolveSellPrice({
      supplierCost: cost,
      listPrice: product.price,
      productMarginPercent: product.internal_margin,
      companyMarginPercent: surface === 'store' ? null : companyMarginPercent,
      channel: surface === 'store' ? 'b2c' : 'b2b',
      settings,
    })
    prices.set(product.id, resolved.sellPrice)
  }
  return prices
}

export async function getCompanyMarginPercent(companyId: string): Promise<number | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('margin_percent')
    .eq('id', companyId)
    .maybeSingle()
  if (data?.margin_percent == null) return null
  const n = Number(data.margin_percent)
  return Number.isFinite(n) ? n : null
}

export async function resolveProductSellPrice(
  product: ProductPriceRow,
  options: {
    channel: PriceChannel
    companyId?: string | null
    companyMarginPercent?: number | null
    settings?: MarginSettings | null
  }
): Promise<ResolvedPrice> {
  const settings = options.settings === undefined ? await loadMarginSettings() : options.settings
  let companyMargin = options.companyMarginPercent
  if (companyMargin === undefined && options.companyId && options.channel === 'b2b') {
    companyMargin = await getCompanyMarginPercent(options.companyId)
  }

  return resolveSellPrice({
    supplierCost: product.supplier_cost,
    listPrice: product.price,
    productMarginPercent: product.internal_margin,
    companyMarginPercent: options.channel === 'b2b' ? companyMargin : null,
    channel: options.channel,
    settings,
  })
}
