import { NextResponse } from 'next/server'
import { canSeeCosts, canViewPricing, getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPricingSettings, loadEffectiveCosts, resolveListedPrices, type ProductCostBasis } from '@/lib/pricing/server'
import type { PricingPortal } from '@/lib/pricing/engine'

export const dynamic = 'force-dynamic'

const PORTALS: PricingPortal[] = ['store', 'business', 'corporate']

function cell(value: string) {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

function text(value: number | null | undefined) {
  return value == null ? '' : String(value)
}

/**
 * Pricing CSV. Import columns: sku, cost_price, cost_source, *_fixed_price, *_margin_percent.
 * Reference only (ignored on import): name, *_effective_cost (cost basis per portal), retail_price (frozen products.price),
 * *_sell_price (what each portal charges with no company).
 */
export async function GET() {
  const profile = await getProfile()
  if (!profile || !canViewPricing(profile.role)) {
    return new NextResponse('Not allowed', { status: 403 })
  }
  const showCost = canSeeCosts(profile.role)
  const supabase = await createClient()
  const settings = await getPricingSettings()
  const [{ data: products }, fixed, margins] = await Promise.all([
    supabase.from('products').select('id, sku, name, price').eq('status', 'active').order('sku').limit(2000),
    supabase.from('portal_product_prices').select('product_id, portal, price'),
    supabase.from('portal_product_margins').select('product_id, portal, margin_percent'),
  ])
  const rows = products || []
  const ids = rows.map((product) => product.id)
  const costClient = createAdminClient() || supabase
  const costs = new Map<PricingPortal, Map<string, ProductCostBasis>>()
  if (showCost) {
    for (const portal of PORTALS) {
      costs.set(portal, await loadEffectiveCosts(costClient, ids, { requireInStock: settings.requireInStock, portalDefault: settings.portals[portal].costSource }))
    }
  }
  const sell = new Map<PricingPortal, Map<string, { price: number | null }> | null>()
  for (const portal of PORTALS) {
    sell.set(portal, await resolveListedPrices(ids.map((id) => ({ id })), portal, null, null, settings))
  }
  const fixedPrice = new Map<string, string>()
  for (const row of fixed.data || []) fixedPrice.set(`${row.product_id}:${row.portal}`, text(row.price == null ? null : Number(row.price)))
  const marginOf = new Map<string, string>()
  if (!margins.error) {
    for (const row of margins.data || []) marginOf.set(`${row.product_id}:${row.portal}`, text(row.margin_percent == null ? null : Number(row.margin_percent)))
  }
  const headers = [
    'sku',
    'name',
    ...(showCost ? ['cost_price', 'cost_source', 'store_effective_cost', 'business_effective_cost', 'corporate_effective_cost'] : []),
    'store_fixed_price',
    'business_fixed_price',
    'corporate_fixed_price',
    'store_margin_percent',
    'business_margin_percent',
    'corporate_margin_percent',
    'store_sell_price',
    'business_sell_price',
    'corporate_sell_price',
    'retail_price',
  ]
  const lines = [headers.join(',')]
  for (const product of rows) {
    const basis = costs.get('store')?.get(product.id)
    const values = [
      product.sku || '',
      product.name || '',
      ...(showCost
        ? [text(basis?.manualCost), basis?.source || 'portal_default', ...PORTALS.map((portal) => text(costs.get(portal)?.get(product.id)?.cost))]
        : []),
      ...PORTALS.map((portal) => fixedPrice.get(`${product.id}:${portal}`) || ''),
      ...PORTALS.map((portal) => marginOf.get(`${product.id}:${portal}`) || ''),
      ...PORTALS.map((portal) => text(sell.get(portal)?.get(product.id)?.price)),
      text(product.price == null ? null : Number(product.price)),
    ]
    lines.push(values.map((value) => cell(String(value))).join(','))
  }
  return new NextResponse(lines.join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="pricing.csv"',
    },
  })
}
