import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePortalPrice, type PricingPortal, type ResolvedPortalPrice } from '@/lib/pricing/engine'
import type { MarginSettings } from '@/lib/pricing/resolve'
import type { SupplierOffer } from '@/lib/pricing/offers'
import { asCostSource, effectiveCost, type CostSource, type EffectiveCost } from '@/lib/pricing/cost-basis'
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

export type ProductCostBasis = EffectiveCost & {
  source: CostSource
  manualCost: number | null
}

function finiteOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * The effective cost per product, the same as public.effective_product_cost.
 * Before 20261022_pricing_cost_basis.sql is applied there is no cost_source column and every product is manual.
 */
export async function loadEffectiveCosts(
  client: SupabaseClient,
  productIds: string[],
  options: { requireInStock: boolean; quantity?: number | null },
): Promise<Map<string, ProductCostBasis>> {
  const result = new Map<string, ProductCostBasis>()
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return result
  let rows: { product_id: string; supplier_cost: number | null; cost_source?: string | null }[] = []
  const withSource = await client.from('product_costs').select('product_id, supplier_cost, cost_source').in('product_id', ids)
  if (withSource.error && /cost_source/i.test(withSource.error.message)) {
    const plain = await client.from('product_costs').select('product_id, supplier_cost').in('product_id', ids)
    rows = (plain.data || []) as typeof rows
  } else {
    rows = (withSource.data || []) as typeof rows
  }
  const byProduct = new Map(rows.map((row) => [row.product_id, row]))
  const needOffers = rows.filter((row) => asCostSource(row.cost_source) !== 'manual').map((row) => row.product_id)
  const [offers, moqRows] = needOffers.length
    ? await Promise.all([
      loadSupplierOffers(client, needOffers),
      client.from('products').select('id, moq').in('id', needOffers),
    ])
    : [[] as SupplierOffer[], { data: [] as { id: string; moq: number | null }[] }]
  const moq = new Map(((moqRows.data || []) as { id: string; moq: number | null }[]).map((row) => [row.id, row.moq]))
  for (const id of ids) {
    const row = byProduct.get(id)
    const source = asCostSource(row?.cost_source)
    const manualCost = finiteOrNull(row?.supplier_cost)
    const resolved = effectiveCost({
      source,
      manualCost,
      offers: offers.filter((offer) => offer.product_id === id),
      quantity: options.quantity ?? null,
      productMoq: moq.get(id) ?? null,
      requireInStock: options.requireInStock,
    })
    result.set(id, { ...resolved, source, manualCost })
  }
  return result
}

/** Per-product portal margins. Empty until 20261022_pricing_cost_basis.sql is applied. */
export async function loadProductMargins(
  client: SupabaseClient,
  productIds: string[],
  portal: PricingPortal,
): Promise<Map<string, number>> {
  const margins = new Map<string, number>()
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return margins
  const { data, error } = await client
    .from('portal_product_margins')
    .select('product_id, margin_percent')
    .eq('portal', portal)
    .in('product_id', ids)
  if (error || !data) return margins
  for (const row of data as { product_id: string; margin_percent: number }[]) {
    const n = Number(row.margin_percent)
    if (Number.isFinite(n)) margins.set(row.product_id, n)
  }
  return margins
}

type SpecialPrice = { price: number; validUntil: string | null }

/**
 * Company fixed prices. A row with a portal applies to that portal only; a row without one applies to
 * business and corporate. Pass the portal to filter; omit it to get every row (admin lists).
 */
export async function specialPricesForCompany(
  client: SupabaseClient,
  companyId: string | null | undefined,
  productIds: string[],
  portal?: PricingPortal,
): Promise<Map<string, SpecialPrice>> {
  const prices = new Map<string, SpecialPrice>()
  if (!companyId || !productIds.length) return prices
  let rows: { product_id: string; price: number; valid_until: string | null; portal?: string | null }[] = []
  const scoped = await client
    .from('company_product_prices')
    .select('product_id, price, valid_until, portal')
    .eq('company_id', companyId)
    .in('product_id', productIds)
  if (scoped.error && /portal/i.test(scoped.error.message)) {
    const plain = await client
      .from('company_product_prices')
      .select('product_id, price, valid_until')
      .eq('company_id', companyId)
      .in('product_id', productIds)
    if (plain.error || !plain.data) return prices
    rows = plain.data as typeof rows
  } else {
    if (scoped.error || !scoped.data) return prices
    rows = scoped.data as typeof rows
  }
  for (const row of rows) {
    if (portal && row.portal && row.portal !== portal) continue
    prices.set(row.product_id, { price: Number(row.price), validUntil: row.valid_until })
  }
  return prices
}

type ListedTarget = {
  id: string
  /** Product the special price and portal fixed price belong to. Defaults to id. */
  productId?: string
  /** Leave undefined to use the product's effective cost. */
  costPrice?: number | null
  catalogManualPrice?: number | null
}

export async function resolveListedPrices(
  targets: ListedTarget[],
  portal: PricingPortal,
  companyMarginPercent: number | null,
  companyId?: string | null,
  settings?: PricingSettings,
  client?: SupabaseClient,
): Promise<Map<string, ResolvedPortalPrice> | null> {
  if (!targets.length) return new Map()
  const admin = client || createAdminClient()
  if (!admin) return null
  const rules = settings || (await getPricingSettings())
  const rule = rules.portals[portal]
  const productIds = [...new Set(targets.map((target) => target.productId || target.id))]
  const needCost = targets.some((target) => target.costPrice === undefined)
  const [specials, fixedRows, costs, margins] = await Promise.all([
    portal === 'store' ? Promise.resolve(new Map<string, SpecialPrice>()) : specialPricesForCompany(admin, companyId, productIds, portal),
    admin
      .from('portal_product_prices')
      .select('product_id, price, valid_until')
      .eq('portal', portal)
      .in('product_id', productIds),
    needCost
      ? loadEffectiveCosts(admin, productIds, { requireInStock: rules.requireInStock })
      : Promise.resolve(new Map<string, ProductCostBasis>()),
    loadProductMargins(admin, productIds, portal),
  ])
  const fixed = new Map<string, { price: number; validUntil: string | null }>()
  if (!fixedRows.error) {
    for (const row of (fixedRows.data || []) as { product_id: string; price: number; valid_until: string | null }[]) {
      fixed.set(row.product_id, { price: Number(row.price), validUntil: row.valid_until })
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
      costPrice: target.costPrice !== undefined ? target.costPrice : costs.get(productId)?.cost ?? null,
      companyMarginPercent,
      productMarginPercent: margins.get(productId) ?? null,
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
  const resolved = await resolveListedPrices(
    productIds.map((id) => ({ id })),
    portalForSurface(surface),
    companyMarginPercent,
    companyId,
    settings,
    admin,
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

