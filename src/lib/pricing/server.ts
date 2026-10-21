import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withProductCost } from '@/lib/pricing/product-costs'
import { resolvePortalPrice, type PricingPortal, type ResolvedPortalPrice } from '@/lib/pricing/engine'
import type { MarginSettings } from '@/lib/pricing/resolve'
import { pickBestOffer, type SupplierOffer } from '@/lib/pricing/offers'
import {
  portalForSurface,
  PORTAL_SETTING_COLUMNS,
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

const PRICING_SETTING_COLUMNS = [...new Set([...SURFACE_SETTING_COLUMNS, ...PORTAL_SETTING_COLUMNS])]

export async function getPricingSettings(): Promise<PricingSettings> {
  const margins = await loadMarginSettings()
  try {
    const admin = createAdminClient()
    const client = admin || (await createClient())
    let result = await client
      .from('org_settings')
      .select(PRICING_SETTING_COLUMNS.join(', '))
      .limit(1)
      .maybeSingle()
    if (result.error && /store_price_base|corporate_|column/i.test(result.error.message)) {
      result = await client
        .from('org_settings')
        .select(SURFACE_SETTING_COLUMNS.join(', '))
        .limit(1)
        .maybeSingle()
    }
    if (result.error || !result.data) return pricingSettingsFromRow(null, margins)
    return pricingSettingsFromRow(result.data as unknown as Record<string, unknown>, margins)
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

type SpecialPrice = { price: number; validUntil: string | null }

export async function specialPricesForCompany(
  client: SupabaseClient,
  companyId: string | null | undefined,
  productIds: string[],
): Promise<Map<string, SpecialPrice>> {
  const prices = new Map<string, SpecialPrice>()
  if (!companyId || !productIds.length) return prices
  const { data, error } = await client
    .from('company_product_prices')
    .select('product_id, price, valid_until')
    .eq('company_id', companyId)
    .in('product_id', productIds)
  if (error || !data) return prices
  for (const row of data as { product_id: string; price: number; valid_until: string | null }[]) {
    prices.set(row.product_id, { price: Number(row.price), validUntil: row.valid_until })
  }
  return prices
}

type ListedTarget = {
  id: string
  /** Product the special price and portal fixed price belong to. Defaults to id. */
  productId?: string
  retailPrice: number | null
  costPrice?: number | null
  catalogManualPrice?: number | null
}

export async function resolveListedPrices(
  targets: ListedTarget[],
  portal: PricingPortal,
  companyMarginPercent: number | null,
  companyId?: string | null,
  settings?: PricingSettings,
): Promise<Map<string, ResolvedPortalPrice> | null> {
  if (!targets.length) return new Map()
  const admin = createAdminClient()
  if (!admin) return null
  const rules = settings || (await getPricingSettings())
  const rule = rules.portals[portal]
  const productIds = [...new Set(targets.map((target) => target.productId || target.id))]
  const needCost = targets.some((target) => target.costPrice === undefined)
  const [specials, fixedRows, costRows] = await Promise.all([
    portal === 'store' ? Promise.resolve(new Map()) : specialPricesForCompany(admin, companyId, productIds),
    admin
      .from('portal_product_prices')
      .select('product_id, price, valid_until')
      .eq('portal', portal)
      .in('product_id', productIds),
    needCost
      ? admin.from('product_costs').select('product_id, supplier_cost').in('product_id', productIds)
      : Promise.resolve({ data: [] as { product_id: string; supplier_cost: number | null }[], error: null }),
  ])
  const fixed = new Map<string, { price: number; validUntil: string | null }>()
  if (!fixedRows.error) {
    for (const row of (fixedRows.data || []) as { product_id: string; price: number; valid_until: string | null }[]) {
      fixed.set(row.product_id, { price: Number(row.price), validUntil: row.valid_until })
    }
  }
  const costs = new Map<string, number | null>()
  if (!costRows.error) {
    for (const row of costRows.data || []) {
      costs.set(row.product_id, row.supplier_cost == null ? null : Number(row.supplier_cost))
    }
  }
  const prices = new Map<string, ResolvedPortalPrice>()
  for (const target of targets) {
    const productId = target.productId || target.id
    const special = specials.get(productId)
    const portalFixed = fixed.get(productId)
    prices.set(target.id, resolvePortalPrice({
      portal,
      rule,
      retailPrice: target.retailPrice,
      costPrice: target.costPrice !== undefined ? target.costPrice : costs.get(productId) ?? null,
      companyMarginPercent,
      specialPrice: special?.price,
      specialValidUntil: special?.validUntil,
      catalogManualPrice: target.catalogManualPrice,
      portalFixedPrice: portalFixed?.price,
      portalFixedValidUntil: portalFixed?.validUntil,
    }))
  }
  return prices
}

export async function sellPricesForSurface(
  productIds: string[],
  surface: PriceSurface,
  companyMarginPercent: number | null,
  companyId?: string | null,
): Promise<Map<string, number | null> | null> {
  if (!productIds.length) return new Map()
  const admin = createAdminClient()
  if (!admin) return null
  const settings = await getPricingSettings()
  const flags = settings.surfaces[surface]
  if (!flags.showSellPrice) {
    return new Map(productIds.map((id) => [id, null]))
  }
  const embedded = await admin
    .from('products')
    .select('id, price, product_costs(supplier_cost)')
    .in('id', productIds)
  const fallback = embedded.error && /product_costs/i.test(embedded.error.message)
    ? await admin.from('products').select('id, price').in('id', productIds)
    : null
  const products = fallback ? fallback.data : embedded.data
  const error = fallback ? fallback.error : embedded.error
  if (error || !products) return null
  const resolved = await resolveListedPrices(
    products.map((row) => {
      const product = withProductCost(row)
      return { id: product.id as string, retailPrice: product.price == null ? null : Number(product.price), costPrice: product.supplier_cost }
    }),
    portalForSurface(surface),
    companyMarginPercent,
    companyId,
    settings,
  )
  if (!resolved) return null
  const prices = new Map<string, number | null>()
  for (const [id, price] of resolved) prices.set(id, price.price)
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

