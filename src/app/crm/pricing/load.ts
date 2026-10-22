import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { canSeeCosts, type ProfileSession } from '@/lib/auth'
import {
  resolvePortalPrice,
  SOURCE_LABEL,
  type PricingPortal,
} from '@/lib/pricing/engine'
import { getPricingSettings, loadEffectiveCosts, type ProductCostBasis } from '@/lib/pricing/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CostSource } from '@/lib/pricing/cost-basis'
import type { PricingSettings } from '@/lib/pricing/surfaces'
import { oneRelation } from '@/lib/utils'

export type GridCell = {
  price: number | null
  source: string
  belowFloor: boolean
  marginOverCost: number | null
}

export type GridRow = {
  id: string
  name: string
  sku: string
  imageUrl: string | null
  category: string | null
  categoryId: string | null
  /** Effective cost (what prices are built from). Null when hidden or missing. */
  cost: number | null
  /** The stored manual cost, shown when the source is an offer. */
  manualCost: number | null
  costSource: CostSource
  /** Per-product portal margin and fixed price, the editable overrides. */
  margins: Record<PricingPortal, number | null>
  fixed: Record<PricingPortal, number | null>
  store: GridCell
  business: GridCell
  corporate: GridCell
}

export type RuleSample = {
  id: string
  name: string
  sku: string
  cost: number | null
}

export type LogRow = {
  id: string
  at: string
  actor: string
  field: string
  portal: string | null
  product: string | null
  company: string | null
  oldValue: string | null
  newValue: string | null
}

export type CompanyOption = { id: string; name: string; margin: number | null; accountType: string | null }

export type SpecialRow = {
  productId: string
  name: string
  sku: string
  imageUrl?: string | null
  price: number
  validUntil: string | null
  /** Null = business and corporate. */
  portal: PricingPortal | null
  migrated: boolean
}

export type CatalogFixedRow = {
  id: string
  campaignId: string
  campaign: string
  productId: string
  name: string
  imageUrl?: string | null
  manualPrice: number | null
}

export type DrillCompany = {
  id: string
  name: string
  margin: number | null
  business: GridCell
  corporate: GridCell
  special: number | null
  specialUntil: string | null
}

export type DrillCatalog = { campaign: string; manualPrice: number | null; sellingPrice: number | null }

function num(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function cell(
  portal: PricingPortal,
  product: { cost: number | null; margins: Partial<Record<PricingPortal, number | null>> },
  fixed: { price: number; valid_until: string | null } | undefined,
  settings: PricingSettings,
  showCost: boolean,
  companyMargin?: number | null,
  special?: { price: number; validUntil: string | null } | null,
  catalogManual?: number | null,
): GridCell {
  const resolved = resolvePortalPrice({
    portal,
    rule: settings.portals[portal],
    costPrice: product.cost,
    productMarginPercent: product.margins[portal] ?? null,
    companyMarginPercent: companyMargin,
    specialPrice: special?.price,
    specialValidUntil: special?.validUntil,
    catalogManualPrice: catalogManual,
    portalFixedPrice: fixed?.price,
    portalFixedValidUntil: fixed?.valid_until,
  })
  return {
    price: resolved.price,
    source: SOURCE_LABEL[resolved.source],
    belowFloor: showCost ? resolved.belowFloor : false,
    marginOverCost: showCost ? resolved.marginOverCost : null,
  }
}

export async function loadPricingPage(profile: ProfileSession, companyId: string | null, productId: string | null) {
  const showCost = canSeeCosts(profile.role)
  const supabase = await createClient()
  const settings = await getPricingSettings()
  const probe = await supabase.from('org_settings').select('store_price_base').limit(1).maybeSingle()
  const migrationRequired = Boolean(probe.error && /store_price_base|column|schema cache/i.test(probe.error.message))

  const productQuery = await supabase
    .from('products')
    .select('id, name, sku, image_url, category_id, category:categories(id, name)')
    .eq('status', 'active')
    .order('name')
    .limit(1000)
  const products = productQuery.data || []
  const fixedQuery = await supabase.from('portal_product_prices').select('product_id, portal, price, valid_until')
  const fixedByProduct = new Map<string, Partial<Record<PricingPortal, { price: number; valid_until: string | null }>>>()
  if (!fixedQuery.error) {
    for (const row of fixedQuery.data || []) {
      const portal = row.portal as PricingPortal
      const current = fixedByProduct.get(row.product_id) || {}
      current[portal] = { price: Number(row.price), valid_until: row.valid_until }
      fixedByProduct.set(row.product_id, current)
    }
  }

  // Costs come from the effective-cost rule. Read with the service role so a sales login still sees
  // sell prices; the cost itself is only returned when this profile may see costs.
  const costClient = createAdminClient() || supabase
  const costBasis = await loadEffectiveCosts(costClient, products.map((row) => row.id), { requireInStock: settings.requireInStock })
  const marginQuery = await costClient.from('portal_product_margins').select('product_id, portal, margin_percent')
  const marginsByProduct = new Map<string, Partial<Record<PricingPortal, number | null>>>()
  if (!marginQuery.error) {
    for (const row of (marginQuery.data || []) as { product_id: string; portal: PricingPortal; margin_percent: number }[]) {
      const current = marginsByProduct.get(row.product_id) || {}
      current[row.portal] = num(row.margin_percent)
      marginsByProduct.set(row.product_id, current)
    }
  }
  const basisFor = (id: string): ProductCostBasis | undefined => costBasis.get(id)

  const rows: GridRow[] = products.map((row) => {
    const category = oneRelation(row.category as { id?: string; name?: string | null } | { id?: string; name?: string | null }[] | null)
    const basis = basisFor(row.id)
    const cost = basis?.cost ?? null
    const margins = marginsByProduct.get(row.id) || {}
    const product = { cost, margins }
    const fixed = fixedByProduct.get(row.id)
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url || null,
      category: category?.name || null,
      categoryId: row.category_id,
      cost: showCost ? cost : null,
      manualCost: showCost ? basis?.manualCost ?? null : null,
      costSource: basis?.source || 'manual',
      margins: { store: margins.store ?? null, business: margins.business ?? null, corporate: margins.corporate ?? null },
      fixed: { store: fixed?.store?.price ?? null, business: fixed?.business?.price ?? null, corporate: fixed?.corporate?.price ?? null },
      store: cell('store', product, fixed?.store, settings, showCost),
      business: cell('business', product, fixed?.business, settings, showCost),
      corporate: cell('corporate', product, fixed?.corporate, settings, showCost),
    }
  })

  const samples: RuleSample[] = []
  for (const row of products) {
    const cost = basisFor(row.id)?.cost ?? null
    if (samples.length >= 4) break
    if (samples.some((sample) => (sample.cost == null) === (cost == null)) && samples.length >= 2) continue
    samples.push({
      id: row.id,
      name: row.name,
      sku: row.sku,
      cost: showCost ? cost : null,
    })
  }
  if (samples.length < 4) {
    for (const row of products) {
      if (samples.length >= 4) break
      if (samples.some((sample) => sample.id === row.id)) continue
      const cost = basisFor(row.id)?.cost ?? null
      samples.push({ id: row.id, name: row.name, sku: row.sku, cost: showCost ? cost : null })
    }
  }

  const companyQuery = await supabase
    .from('companies')
    .select('id, name, margin_percent, account_type')
    .order('name')
    .limit(500)
  const companies: CompanyOption[] = (companyQuery.data || []).map((company) => ({
    id: company.id,
    name: company.name,
    margin: num(company.margin_percent),
    accountType: company.account_type,
  }))

  let specials: SpecialRow[] = []
  let catalogFixed: CatalogFixedRow[] = []
  const selected = companies.find((company) => company.id === companyId) || null
  if (selected) {
    const specialQuery = await supabase
      .from('company_product_prices')
      .select('*, product:products(name, sku, image_url)')
      .eq('company_id', selected.id)
    specials = (specialQuery.data || []).map((row) => {
      const product = oneRelation(row.product as { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null)
      return {
        productId: row.product_id,
        name: product?.name || 'Product',
        sku: product?.sku || '',
        imageUrl: product?.image_url || null,
        price: Number(row.price),
        validUntil: row.valid_until,
        portal: (row.portal as PricingPortal | null | undefined) || null,
        migrated: row.source === 'migrated_from_retail',
      }
    })
    const assigned = await supabase.from('catalog_assignments').select('campaign_id').eq('company_id', selected.id)
    const owned = await supabase.from('campaigns').select('id').eq('company_id', selected.id)
    const campaignIds = [...new Set([
      ...(assigned.data || []).map((row) => row.campaign_id as string),
      ...(owned.data || []).map((row) => row.id as string),
    ])]
    if (campaignIds.length) {
      const lines = await supabase
        .from('campaign_products')
        .select('id, campaign_id, product_id, manual_price, selling_price, product:products(name, image_url), campaign:campaigns(name)')
        .in('campaign_id', campaignIds)
        .limit(300)
      catalogFixed = (lines.data || [])
        .filter((row) => row.manual_price != null)
        .map((row) => ({
          id: row.id as string,
          campaignId: row.campaign_id as string,
          campaign: oneRelation(row.campaign as { name?: string } | { name?: string }[] | null)?.name || 'Catalog',
          productId: row.product_id as string,
          name: oneRelation(row.product as { name?: string } | { name?: string }[] | null)?.name || 'Product',
          imageUrl: oneRelation(row.product as { image_url?: string | null } | { image_url?: string | null }[] | null)?.image_url || null,
          manualPrice: num(row.manual_price),
        }))
    }
  }

  let drill: {
    product: GridRow
    companies: DrillCompany[]
    catalogs: DrillCatalog[]
  } | null = null
  const focus = rows.find((row) => row.id === productId) || null
  if (focus) {
    const specialsForProduct = await supabase
      .from('company_product_prices')
      .select('*, company:companies(name, margin_percent)')
      .eq('product_id', focus.id)
    const companyRows = new Map<string, DrillCompany>()
    for (const company of companies) {
      if (company.margin == null) continue
      const product = { cost: basisFor(focus.id)?.cost ?? null, margins: focus.margins }
      const fixed = fixedByProduct.get(focus.id)
      companyRows.set(company.id, {
        id: company.id,
        name: company.name,
        margin: company.margin,
        business: cell('business', product, fixed?.business, settings, showCost, company.margin),
        corporate: cell('corporate', product, fixed?.corporate, settings, showCost, company.margin),
        special: null,
        specialUntil: null,
      })
    }
    for (const row of specialsForProduct.data || []) {
      const company = oneRelation(row.company as { name?: string; margin_percent?: number | null } | { name?: string; margin_percent?: number | null }[] | null)
      const margin = num(company?.margin_percent)
      const product = { cost: basisFor(focus.id)?.cost ?? null, margins: focus.margins }
      const special = { price: Number(row.price), validUntil: row.valid_until as string | null }
      const scope = (row.portal as string | null | undefined) || null
      const fixed = fixedByProduct.get(focus.id)
      companyRows.set(row.company_id, {
        id: row.company_id,
        name: company?.name || 'Company',
        margin,
        business: cell('business', product, fixed?.business, settings, showCost, margin, scope && scope !== 'business' ? null : special),
        corporate: cell('corporate', product, fixed?.corporate, settings, showCost, margin, scope && scope !== 'corporate' ? null : special),
        special: Number(row.price),
        specialUntil: row.valid_until,
      })
    }
    const catalogs = await supabase
      .from('campaign_products')
      .select('manual_price, selling_price, campaign:campaigns(name)')
      .eq('product_id', focus.id)
      .limit(50)
    drill = {
      product: focus,
      companies: [...companyRows.values()].slice(0, 80),
      catalogs: (catalogs.data || []).map((row) => ({
        campaign: oneRelation(row.campaign as { name?: string } | { name?: string }[] | null)?.name || 'Catalog',
        manualPrice: num(row.manual_price),
        sellingPrice: num(row.selling_price),
      })),
    }
  }

  const logQuery = profile.role === 'sales'
    ? supabase.from('price_change_log').select('id, created_at, actor_id, field, portal, product_id, company_id, old_value, new_value').neq('field', 'cost').order('created_at', { ascending: false }).limit(80)
    : supabase.from('price_change_log').select('id, created_at, actor_id, field, portal, product_id, company_id, old_value, new_value').order('created_at', { ascending: false }).limit(80)
  const logResult = await logQuery
  let log: LogRow[] = []
  let logMissing = false
  if (logResult.error && /price_change_log|schema cache/i.test(logResult.error.message)) {
    logMissing = true
  } else if (logResult.data?.length) {
    const actorIds = [...new Set(logResult.data.map((row) => row.actor_id).filter(Boolean))] as string[]
    const productIds = [...new Set(logResult.data.map((row) => row.product_id).filter(Boolean))] as string[]
    const companyIds = [...new Set(logResult.data.map((row) => row.company_id).filter(Boolean))] as string[]
    const [actors, namedProducts, namedCompanies] = await Promise.all([
      actorIds.length ? supabase.from('profiles').select('id, full_name, email').in('id', actorIds) : Promise.resolve({ data: [] }),
      productIds.length ? supabase.from('products').select('id, name, sku').in('id', productIds) : Promise.resolve({ data: [] }),
      companyIds.length ? supabase.from('companies').select('id, name').in('id', companyIds) : Promise.resolve({ data: [] }),
    ])
    const actorName = new Map((actors.data || []).map((row) => [row.id, row.full_name || row.email || 'Staff']))
    const productName = new Map((namedProducts.data || []).map((row) => [row.id, `${row.name} (${row.sku})`]))
    const companyName = new Map((namedCompanies.data || []).map((row) => [row.id, row.name]))
    log = logResult.data.map((row) => ({
      id: row.id,
      at: row.created_at,
      actor: row.actor_id ? actorName.get(row.actor_id) || 'Staff' : 'Staff',
      field: row.field,
      portal: row.portal,
      product: row.product_id ? productName.get(row.product_id) || null : null,
      company: row.company_id ? companyName.get(row.company_id) || null : null,
      oldValue: row.old_value,
      newValue: row.new_value,
    }))
  }

  const micrositeHiddenSeparately = settings.surfaces.microsite.showSellPrice !== settings.surfaces.portal.showSellPrice

  return {
    showCost,
    migrationRequired: migrationRequired || Boolean(fixedQuery.error && /portal_product_prices|schema cache/i.test(fixedQuery.error.message)),
    settings,
    rows,
    samples,
    companies,
    selected,
    specials,
    catalogFixed,
    drill,
    log,
    logMissing,
    micrositeHiddenSeparately,
    productError: productQuery.error?.message || null,
  }
}
