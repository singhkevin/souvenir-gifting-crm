'use server'

import { revalidatePath } from 'next/cache'
import { canEditPricing, getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { recordPriceChange } from '@/lib/pricing/audit'
import {
  applyPriceRounding,
  fixedPriceBlockReason,
  resolvePortalPrice,
  type GstMode,
  type PricingPortal,
  type RoundingMode,
} from '@/lib/pricing/engine'
import { pickBestOffer } from '@/lib/pricing/offers'
import { upsertProductCost } from '@/lib/pricing/product-costs'
import { getPricingSettings, loadEffectiveCosts, loadProductMargins, loadSupplierOffers } from '@/lib/pricing/server'
import { asResolvedCostSource, parseCostSource, parsePortalCostSource, type CostSource } from '@/lib/pricing/cost-basis'
import { isUuid } from '@/lib/utils'

const PORTALS: PricingPortal[] = ['store', 'business', 'corporate']

function reprice() {
  revalidatePath('/crm/pricing')
  revalidatePath('/crm/products')
  revalidatePath('/portal/gifts')
  revalidatePath('/business/catalogue')
  revalidatePath('/catalogue')
}

async function editor() {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (!canEditPricing(profile.role)) return { error: 'Only admin and accounts can edit prices' as const }
  return { profile }
}

function asPortal(value: string): PricingPortal | null {
  return PORTALS.includes(value as PricingPortal) ? value as PricingPortal : null
}

function money(value: string): number | null | 'bad' {
  const raw = value.trim()
  if (!raw) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return 'bad'
  return n
}

/** The stored manual cost. */
async function costOf(productId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('product_costs').select('supplier_cost').eq('product_id', productId).maybeSingle()
  return data?.supplier_cost == null ? null : Number(data.supplier_cost)
}

/** The cost prices are built from (manual or the chosen supplier offer). Used for the margin floor. */
async function effectiveCostOf(productId: string, portal: PricingPortal) {
  const supabase = await createClient()
  const settings = await getPricingSettings()
  const costs = await loadEffectiveCosts(supabase, [productId], { requireInStock: settings.requireInStock, portalDefault: settings.portals[portal].costSource })
  return costs.get(productId)?.cost ?? null
}

const MIGRATION_HINT = 'Apply supabase/migrations/20261022_pricing_cost_basis.sql, then retry.'

export async function savePortalRules(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const supabase = await createClient()
  const { data: existing } = await supabase.from('org_settings').select('*').limit(1).maybeSingle()
  if (!existing) return { error: 'Organisation settings are missing' }

  const readMode = <T extends string>(key: string, allowed: readonly T[], fallback: T): T | 'bad' => {
    const value = String(formData.get(key) || '')
    return (allowed as readonly string[]).includes(value) ? value as T : value ? 'bad' : fallback
  }
  const show = (key: string) => formData.getAll(key).includes('1')
  const payload: Record<string, unknown> = {}
  const changes: { portal: PricingPortal; oldValue: string; newValue: string }[] = []

  for (const portal of PORTALS) {
    const marginRaw = String(formData.get(`${portal}_margin`) ?? '').trim()
    const margin = marginRaw === '' ? null : Number(marginRaw)
    if (marginRaw !== '' && (!Number.isFinite(margin) || (margin as number) < 0)) {
      return { error: `${portal} margin must be blank or a number of 0 or more` }
    }
    const rounding = readMode<RoundingMode>(`${portal}_rounding`, ['none', 'whole', 'end9', 'end99'], 'none')
    const gst = readMode<GstMode>(`${portal}_gst`, ['inclusive', 'exclusive'], portal === 'store' ? 'inclusive' : 'exclusive')
    if (rounding === 'bad' || gst === 'bad') {
      return { error: 'Choose a valid rounding and GST mode' }
    }
    const floorRaw = String(formData.get(`${portal}_floor`) ?? '').trim()
    const floor = floorRaw === '' ? 0 : Number(floorRaw)
    if (!Number.isFinite(floor) || floor < 0) return { error: `${portal} minimum margin must be 0 or more` }

    const costSource = parsePortalCostSource(formData.get(`${portal}_cost_source`))
    if (!costSource.ok) return { error: costSource.error }
    const next = {
      margin,
      rounding,
      gst,
      floor,
      show: show(`${portal}_show`),
      costSource: costSource.value,
    }
    const previous = {
      margin: existing[`${portal}_margin_percent`] == null ? null : Number(existing[`${portal}_margin_percent`]),
      rounding: existing[`${portal}_rounding`] || 'none',
      gst: existing[`${portal}_gst_mode`] || (portal === 'store' ? 'inclusive' : 'exclusive'),
      floor: existing[`${portal}_min_margin_percent`] == null ? 0 : Number(existing[`${portal}_min_margin_percent`]),
      show: portal === 'corporate'
        ? existing.portal_show_sell_price !== false
        : existing[`${portal}_show_sell_price`] !== false,
      costSource: asResolvedCostSource(existing[`${portal}_default_cost_source`]),
    }
    payload[`${portal}_margin_percent`] = next.margin
    payload[`${portal}_rounding`] = next.rounding
    payload[`${portal}_gst_mode`] = next.gst
    payload[`${portal}_min_margin_percent`] = next.floor
    if (`${portal}_default_cost_source` in existing) payload[`${portal}_default_cost_source`] = next.costSource
    else if (next.costSource !== 'manual') return { error: MIGRATION_HINT }
    if (portal === 'store') payload.store_show_sell_price = next.show
    if (portal === 'business') payload.business_show_sell_price = next.show
    if (portal === 'corporate') {
      payload.portal_show_sell_price = next.show
      payload.microsite_show_sell_price = next.show
    }
    const oldValue = JSON.stringify(previous)
    const newValue = JSON.stringify(next)
    if (oldValue !== newValue) changes.push({ portal, oldValue, newValue })
  }

  const { error } = await supabase.from('org_settings').update(payload).eq('id', existing.id)
  if (error) {
    if (/store_price_base|column|schema cache/i.test(error.message)) {
      return { error: 'Apply supabase/migrations/20261021_pricing_engine.sql, then retry.' }
    }
    return { error: error.message }
  }
  for (const change of changes) {
    const logError = await recordPriceChange(supabase, {
      actorId: access.profile.id,
      portal: change.portal,
      field: 'portal_rule',
      oldValue: change.oldValue,
      newValue: change.newValue,
    })
    if (logError) return { error: logError }
  }
  reprice()
  revalidatePath('/crm/settings')
  return { success: true }
}

export async function setPortalFixedPrice(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const productId = String(formData.get('product_id') || '')
  const portal = asPortal(String(formData.get('portal') || ''))
  if (!isUuid(productId) || !portal) return { error: 'Choose a product and a portal' }
  const clear = formData.get('clear') === '1'
  const parsed = money(String(formData.get('price') ?? ''))
  if (!clear && parsed === 'bad') return { error: 'Enter a price of zero or more' }
  if (!clear && parsed == null) return { error: 'Enter a price, or clear the fixed price' }

  const supabase = await createClient()
  const { data: previous } = await supabase
    .from('portal_product_prices')
    .select('price')
    .eq('product_id', productId)
    .eq('portal', portal)
    .maybeSingle()

  if (clear) {
    const { error } = await supabase.from('portal_product_prices').delete().eq('product_id', productId).eq('portal', portal)
    if (error) return { error: error.message }
    const logError = await recordPriceChange(supabase, {
      actorId: access.profile.id,
      productId,
      portal,
      field: 'portal_fixed',
      oldValue: previous?.price == null ? null : String(previous.price),
      newValue: null,
    })
    if (logError) return { error: logError }
    reprice()
    return { success: true }
  }

  const settings = await getPricingSettings()
  const blocked = fixedPriceBlockReason(parsed as number, await effectiveCostOf(productId, portal), settings.portals[portal].minMarginPercent)
  if (blocked) return { error: blocked }
  const { error } = await supabase.from('portal_product_prices').upsert({
    product_id: productId,
    portal,
    price: parsed,
    valid_until: null,
    updated_by: access.profile.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id,portal' })
  if (error) {
    if (/portal_product_prices|schema cache/i.test(error.message)) {
      return { error: 'Apply supabase/migrations/20261021_pricing_engine.sql, then retry.' }
    }
    return { error: error.message }
  }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    portal,
    field: 'portal_fixed',
    oldValue: previous?.price == null ? null : String(previous.price),
    newValue: String(parsed),
  })
  if (logError) return { error: logError }
  reprice()
  return { success: true }
}

export async function setCostPrice(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const productId = String(formData.get('product_id') || '')
  if (!isUuid(productId)) return { error: 'Product not found' }
  const parsed = money(String(formData.get('price') ?? ''))
  if (parsed === 'bad') return { error: 'Enter a cost of zero or more, or leave it blank' }
  const supabase = await createClient()
  const previous = await costOf(productId)
  const { error } = await upsertProductCost(supabase, productId, { supplier_cost: parsed })
  if (error) return { error: error.message }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    field: 'cost',
    oldValue: previous == null ? null : String(previous),
    newValue: parsed == null ? null : String(parsed),
  })
  if (logError) return { error: logError }
  reprice()
  return { success: true }
}

/** Margin over cost for one product on one portal. Blank clears it. */
export async function setPortalMargin(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const productId = String(formData.get('product_id') || '')
  const portal = asPortal(String(formData.get('portal') || ''))
  if (!isUuid(productId) || !portal) return { error: 'Choose a product and a portal' }
  const raw = String(formData.get('margin') ?? '').trim()
  const clear = formData.get('clear') === '1' || raw === ''
  const margin = clear ? null : Number(raw)
  if (!clear && (!Number.isFinite(margin) || (margin as number) < 0 || (margin as number) > 1000)) {
    return { error: 'Enter a margin from 0 to 1000, or leave it blank' }
  }
  const supabase = await createClient()
  const { data: previous, error: readError } = await supabase
    .from('portal_product_margins')
    .select('margin_percent')
    .eq('product_id', productId)
    .eq('portal', portal)
    .maybeSingle()
  if (readError && /portal_product_margins|schema cache/i.test(readError.message)) return { error: MIGRATION_HINT }
  const result = clear
    ? await supabase.from('portal_product_margins').delete().eq('product_id', productId).eq('portal', portal)
    : await supabase.from('portal_product_margins').upsert({
      product_id: productId,
      portal,
      margin_percent: margin,
      updated_by: access.profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id,portal' })
  if (result.error) return { error: /portal_product_margins|schema cache/i.test(result.error.message) ? MIGRATION_HINT : result.error.message }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    portal,
    field: 'portal_margin',
    oldValue: previous?.margin_percent == null ? null : String(previous.margin_percent),
    newValue: margin == null ? null : String(margin),
  })
  if (logError) return { error: logError }
  reprice()
  return { success: true }
}

/** Where the product's cost comes from: manual, preferred supplier, or lowest eligible offer. */
export async function setCostSource(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const productId = String(formData.get('product_id') || '')
  if (!isUuid(productId)) return { error: 'Product not found' }
  const parsed = parseCostSource(formData.get('cost_source'))
  if (!parsed.ok) return { error: parsed.error }
  const supabase = await createClient()
  const { data: previous, error: readError } = await supabase
    .from('product_costs')
    .select('cost_source')
    .eq('product_id', productId)
    .maybeSingle()
  if (readError && /cost_source/i.test(readError.message)) return { error: MIGRATION_HINT }
  const { error } = await upsertProductCost(supabase, productId, { cost_source: parsed.value })
  if (error) return { error: /cost_source/i.test(error.message) ? MIGRATION_HINT : error.message }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    field: 'cost_source',
    oldValue: (previous?.cost_source as string | null | undefined) || 'portal_default',
    newValue: parsed.value,
  })
  if (logError) return { error: logError }
  reprice()
  return { success: true }
}

export async function useBestOfferAsCost(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const productId = String(formData.get('product_id') || '')
  if (!isUuid(productId)) return { error: 'Product not found' }
  const supabase = await createClient()
  const settings = await getPricingSettings()
  const offers = await loadSupplierOffers(supabase, [productId])
  const best = pickBestOffer(offers, { requireInStock: settings.requireInStock })
  if (!best) return { error: 'No eligible supplier offer to use as the cost price' }
  const previous = await costOf(productId)
  const { error } = await upsertProductCost(supabase, productId, { supplier_cost: best.cost })
  if (error) return { error: error.message }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    field: 'cost',
    oldValue: previous == null ? null : String(previous),
    newValue: String(best.cost),
  })
  if (logError) return { error: logError }
  reprice()
  return { success: true }
}

export async function bulkAdjustPrices(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const portal = asPortal(String(formData.get('portal') || ''))
  const percent = Number(formData.get('percent'))
  const ids = [...new Set(String(formData.get('product_ids') || '').split(',').map((id) => id.trim()).filter(isUuid))]
  if (!portal) return { error: 'Choose a portal' }
  if (!Number.isFinite(percent) || percent <= -100 || percent > 1000) return { error: 'Enter a percent between -99 and 1000' }
  if (!ids.length) return { error: 'Select at least one product' }
  if (ids.length > 500) return { error: 'Adjust at most 500 products at a time' }

  const supabase = await createClient()
  const settings = await getPricingSettings()
  const rule = settings.portals[portal]
  const [{ data: products }, costs, margins, { data: fixed }] = await Promise.all([
    supabase.from('products').select('id').in('id', ids),
    loadEffectiveCosts(supabase, ids, { requireInStock: settings.requireInStock, portalDefault: rule.costSource }),
    loadProductMargins(supabase, ids, portal),
    supabase.from('portal_product_prices').select('product_id, price').eq('portal', portal).in('product_id', ids),
  ])
  const costById = new Map([...costs].map(([id, basis]) => [id, basis.cost]))
  const fixedById = new Map((fixed || []).map((row) => [row.product_id, Number(row.price)]))
  let updated = 0
  const skipped: string[] = []
  for (const product of products || []) {
    const current = resolvePortalPrice({
      portal,
      rule,
      costPrice: costById.get(product.id) ?? null,
      productMarginPercent: margins.get(product.id) ?? null,
      portalFixedPrice: fixedById.get(product.id) ?? null,
    })
    if (current.price == null) {
      skipped.push(product.id)
      continue
    }
    const next = applyPriceRounding(current.price * (1 + percent / 100), rule.rounding)
    const blocked = fixedPriceBlockReason(next, costById.get(product.id) ?? null, rule.minMarginPercent)
    if (blocked) {
      skipped.push(product.id)
      continue
    }
    const { error } = await supabase.from('portal_product_prices').upsert({
      product_id: product.id,
      portal,
      price: next,
      valid_until: null,
      updated_by: access.profile.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_id,portal' })
    if (error) return { error: error.message }
    const logError = await recordPriceChange(supabase, {
      actorId: access.profile.id,
      productId: product.id,
      portal,
      field: 'portal_fixed',
      oldValue: fixedById.has(product.id) ? String(fixedById.get(product.id)) : null,
      newValue: String(next),
    })
    if (logError) return { error: logError }
    updated += 1
  }
  reprice()
  if (skipped.length) return { error: `Updated ${updated}. Left ${skipped.length} unchanged because the price was missing or below the floor.` }
  return { success: true }
}

/**
 * One pricing CSV row. Columns: sku, cost, cost_source, store/business/corporate (fixed price),
 * store_margin/business_margin/corporate_margin. A blank fixed price or margin clears it.
 * The old retail column is not imported (products.price is frozen).
 */
export type CsvChange = {
  sku: string
  cost?: number | null
  cost_source?: CostSource
  store?: number | null
  business?: number | null
  corporate?: number | null
  store_margin?: number | null
  business_margin?: number | null
  corporate_margin?: number | null
}

const MARGIN_KEY: Record<PricingPortal, 'store_margin' | 'business_margin' | 'corporate_margin'> = {
  store: 'store_margin',
  business: 'business_margin',
  corporate: 'corporate_margin',
}

export async function applyPricingCsv(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  let changes: CsvChange[] = []
  try {
    const parsed = JSON.parse(String(formData.get('changes') || '[]'))
    if (!Array.isArray(parsed)) return { error: 'The import file could not be read' }
    changes = parsed
  } catch {
    return { error: 'The import file could not be read' }
  }
  if (!changes.length) return { error: 'Nothing to import' }
  if (changes.length > 1000) return { error: 'Import at most 1000 rows at a time' }

  const supabase = await createClient()
  const settings = await getPricingSettings()
  const skus = [...new Set(changes.map((row) => String(row.sku || '').trim().toUpperCase()).filter(Boolean))]
  const { data: products } = await supabase.from('products').select('id, sku').in('sku', skus)
  const bySku = new Map((products || []).map((product) => [String(product.sku).toUpperCase(), product]))
  const ids = (products || []).map((product) => product.id)
  const effective = await loadEffectiveCosts(supabase, ids, { requireInStock: settings.requireInStock })
  const effectiveByPortal = new Map<PricingPortal, Awaited<ReturnType<typeof loadEffectiveCosts>>>()
  for (const portal of PORTALS) {
    effectiveByPortal.set(portal, await loadEffectiveCosts(supabase, ids, { requireInStock: settings.requireInStock, portalDefault: settings.portals[portal].costSource }))
  }
  const costById = new Map([...effective].map(([id, basis]) => [id, basis.manualCost]))
  const problems: string[] = []

  for (const change of changes) {
    const sku = String(change.sku || '').trim().toUpperCase()
    const product = bySku.get(sku)
    if (!product) {
      problems.push(`${sku || '(blank)'}: product not found`)
      continue
    }
    // The floor uses the cost the row sets, else the product's effective cost.
    const rowCost = 'cost' in change && change.cost != null ? Number(change.cost) : null
    for (const portal of PORTALS) {
      if (!(portal in change) || change[portal] == null) continue
      const price = Number(change[portal])
      if (!Number.isFinite(price) || price < 0) {
        problems.push(`${sku}: ${portal} price is not a number`)
        continue
      }
      const cost = rowCost ?? effectiveByPortal.get(portal)?.get(product.id)?.cost ?? null
      const blocked = fixedPriceBlockReason(price, cost, settings.portals[portal].minMarginPercent)
      if (blocked) problems.push(`${sku}: ${blocked}`)
    }
    for (const portal of PORTALS) {
      const key = MARGIN_KEY[portal]
      if (key in change && change[key] != null && (!Number.isFinite(Number(change[key])) || Number(change[key]) < 0)) {
        problems.push(`${sku}: ${portal} margin is not a number of 0 or more`)
      }
    }
    if ('cost_source' in change && change.cost_source != null && !parseCostSource(change.cost_source).ok) {
      problems.push(`${sku}: cost source must be portal_default, manual, preferred or lowest`)
    }
    if ('cost' in change && change.cost != null && (!Number.isFinite(Number(change.cost)) || Number(change.cost) < 0)) {
      problems.push(`${sku}: cost price is not a number`)
    }
  }
  if (problems.length) return { error: problems.slice(0, 8).join(' ') }

  for (const change of changes) {
    const product = bySku.get(String(change.sku || '').trim().toUpperCase())
    if (!product) continue
    if ('cost' in change) {
      const previous = costById.get(product.id) ?? null
      const { error } = await upsertProductCost(supabase, product.id, { supplier_cost: change.cost ?? null })
      if (error) return { error: error.message }
      const logError = await recordPriceChange(supabase, {
        actorId: access.profile.id,
        productId: product.id,
        field: 'cost',
        oldValue: previous == null ? null : String(previous),
        newValue: change.cost == null ? null : String(change.cost),
      })
      if (logError) return { error: logError }
    }
    if ('cost_source' in change && change.cost_source != null) {
      const parsed = parseCostSource(change.cost_source)
      if (parsed.ok) {
        const previous = effective.get(product.id)?.source || 'portal_default'
        if (previous !== parsed.value) {
          const { error } = await upsertProductCost(supabase, product.id, { cost_source: parsed.value })
          if (error) return { error: /cost_source/i.test(error.message) ? MIGRATION_HINT : error.message }
          const logError = await recordPriceChange(supabase, {
            actorId: access.profile.id,
            productId: product.id,
            field: 'cost_source',
            oldValue: previous,
            newValue: parsed.value,
          })
          if (logError) return { error: logError }
        }
      }
    }
    for (const portal of PORTALS) {
      const key = MARGIN_KEY[portal]
      if (!(key in change)) continue
      const margin = change[key] == null ? null : Number(change[key])
      const { data: previous } = await supabase.from('portal_product_margins').select('margin_percent').eq('product_id', product.id).eq('portal', portal).maybeSingle()
      const result = margin == null
        ? await supabase.from('portal_product_margins').delete().eq('product_id', product.id).eq('portal', portal)
        : await supabase.from('portal_product_margins').upsert({
          product_id: product.id,
          portal,
          margin_percent: margin,
          updated_by: access.profile.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,portal' })
      if (result.error) return { error: /portal_product_margins|schema cache/i.test(result.error.message) ? MIGRATION_HINT : result.error.message }
      const oldValue = previous?.margin_percent == null ? null : String(previous.margin_percent)
      const newValue = margin == null ? null : String(margin)
      if (oldValue !== newValue) {
        const logError = await recordPriceChange(supabase, {
          actorId: access.profile.id,
          productId: product.id,
          portal,
          field: 'portal_margin',
          oldValue,
          newValue,
        })
        if (logError) return { error: logError }
      }
    }
    for (const portal of PORTALS) {
      if (!(portal in change)) continue
      if (change[portal] == null) {
        const { data: previous } = await supabase.from('portal_product_prices').select('price').eq('product_id', product.id).eq('portal', portal).maybeSingle()
        const { error } = await supabase.from('portal_product_prices').delete().eq('product_id', product.id).eq('portal', portal)
        if (error) return { error: error.message }
        const logError = await recordPriceChange(supabase, {
          actorId: access.profile.id,
          productId: product.id,
          portal,
          field: 'portal_fixed',
          oldValue: previous?.price == null ? null : String(previous.price),
          newValue: null,
        })
        if (logError) return { error: logError }
        continue
      }
      const { data: previous } = await supabase.from('portal_product_prices').select('price').eq('product_id', product.id).eq('portal', portal).maybeSingle()
      const { error } = await supabase.from('portal_product_prices').upsert({
        product_id: product.id,
        portal,
        price: change[portal],
        valid_until: null,
        updated_by: access.profile.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id,portal' })
      if (error) return { error: error.message }
      const logError = await recordPriceChange(supabase, {
        actorId: access.profile.id,
        productId: product.id,
        portal,
        field: 'portal_fixed',
        oldValue: previous?.price == null ? null : String(previous.price),
        newValue: String(change[portal]),
      })
      if (logError) return { error: logError }
    }
  }
  reprice()
  return { success: true }
}

export async function savePricingCompanyMargin(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const companyId = String(formData.get('company_id') || '')
  if (!isUuid(companyId)) return { error: 'Choose a company' }
  const raw = String(formData.get('margin_percent') ?? '').trim()
  const margin = raw === '' ? null : Number(raw)
  if (raw !== '' && (!Number.isFinite(margin) || (margin as number) < 0)) return { error: 'Margin % must be blank or 0 or more' }
  const supabase = await createClient()
  const { data: existing } = await supabase.from('companies').select('margin_percent').eq('id', companyId).maybeSingle()
  const { error } = await supabase.from('companies').update({ margin_percent: margin }).eq('id', companyId)
  if (error) return { error: error.message }
  const previous = existing?.margin_percent == null ? null : Number(existing.margin_percent)
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    companyId,
    field: 'company_margin',
    oldValue: previous == null ? null : String(previous),
    newValue: margin == null ? null : String(margin),
  })
  if (logError) return { error: logError }
  reprice()
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function setCatalogManualPrice(formData: FormData) {
  const access = await editor()
  if ('error' in access) return access
  const lineId = String(formData.get('line_id') || '')
  if (!isUuid(lineId)) return { error: 'Catalog line not found' }
  const clear = formData.get('clear') === '1'
  const parsed = money(String(formData.get('price') ?? ''))
  if (!clear && (parsed === 'bad' || parsed == null)) return { error: 'Enter a fixed catalog price, or clear it' }
  const supabase = await createClient()
  const { data: line } = await supabase.from('campaign_products').select('id, product_id, campaign_id, manual_price').eq('id', lineId).maybeSingle()
  if (!line) return { error: 'Catalog line not found' }
  if (!clear) {
    const settings = await getPricingSettings()
    const blocked = fixedPriceBlockReason(parsed as number, await costOf(line.product_id), settings.portals.corporate.minMarginPercent)
    if (blocked) return { error: blocked }
  }
  const { error } = await supabase.from('campaign_products').update({ manual_price: clear ? null : parsed }).eq('id', lineId)
  if (error) return { error: error.message }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId: line.product_id,
    portal: 'corporate',
    field: 'catalog_manual',
    oldValue: line.manual_price == null ? null : String(line.manual_price),
    newValue: clear ? null : String(parsed),
  })
  if (logError) return { error: logError }
  reprice()
  revalidatePath(`/crm/catalogs/${line.campaign_id}`)
  return { success: true }
}
