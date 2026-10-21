import {
  SEEDED_PORTAL_RULES,
  type GstMode,
  type NoCostFallback,
  type PortalRule,
  type PriceBase,
  type PricingPortal,
  type RoundingMode,
} from '@/lib/pricing/engine'
import type { MarginSettings } from '@/lib/pricing/resolve'

export type PriceSurface = 'crm' | 'portal' | 'microsite' | 'store' | 'business'

export type { PortalRule, PricingPortal }

export type SurfacePricing = {
  useBestCost: boolean
  showSellPrice: boolean
}

export type PricingSettings = MarginSettings & {
  requireInStock: boolean
  surfaces: Record<PriceSurface, SurfacePricing>
  portals: Record<PricingPortal, PortalRule>
}

const PORTAL_COLUMNS: Record<PricingPortal, {
  margin: string
  base: string
  fallback: string
  rounding: string
  gst: string
  floor: string
  show: string
}> = {
  store: {
    margin: 'store_margin_percent',
    base: 'store_price_base',
    fallback: 'store_no_cost_fallback',
    rounding: 'store_rounding',
    gst: 'store_gst_mode',
    floor: 'store_min_margin_percent',
    show: 'store_show_sell_price',
  },
  business: {
    margin: 'business_margin_percent',
    base: 'business_price_base',
    fallback: 'business_no_cost_fallback',
    rounding: 'business_rounding',
    gst: 'business_gst_mode',
    floor: 'business_min_margin_percent',
    show: 'business_show_sell_price',
  },
  corporate: {
    margin: 'corporate_margin_percent',
    base: 'corporate_price_base',
    fallback: 'corporate_no_cost_fallback',
    rounding: 'corporate_rounding',
    gst: 'corporate_gst_mode',
    floor: 'corporate_min_margin_percent',
    show: 'portal_show_sell_price',
  },
}

export const PORTAL_SETTING_COLUMNS = [
  ...new Set(Object.values(PORTAL_COLUMNS).flatMap((column) => [
    column.margin,
    column.base,
    column.fallback,
    column.rounding,
    column.gst,
    column.floor,
    column.show,
  ])),
  'microsite_show_sell_price',
]

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback
}

export function portalRuleFromRow(
  row: Record<string, unknown> | null | undefined,
  portal: PricingPortal,
): PortalRule {
  const seed = SEEDED_PORTAL_RULES[portal]
  const column = PORTAL_COLUMNS[portal]
  const margin = row?.[column.margin]
  const marginPercent = margin == null || margin === '' ? null : Number(margin)
  const floor = row?.[column.floor]
  const floorNumber = floor == null || floor === '' ? null : Number(floor)
  return {
    marginPercent: marginPercent != null && Number.isFinite(marginPercent) ? marginPercent : seed.marginPercent,
    base: oneOf<PriceBase>(row?.[column.base], ['retail', 'cost'], seed.base),
    noCostFallback: oneOf<NoCostFallback>(row?.[column.fallback], ['retail_margin', 'on_quote'], seed.noCostFallback),
    rounding: oneOf<RoundingMode>(row?.[column.rounding], ['none', 'whole', 'end9', 'end99'], seed.rounding),
    gstMode: oneOf<GstMode>(row?.[column.gst], ['inclusive', 'exclusive'], seed.gstMode),
    showPrices: flag(row?.[column.show], seed.showPrices),
    minMarginPercent: floorNumber != null && Number.isFinite(floorNumber) ? floorNumber : seed.minMarginPercent,
  }
}

export function portalForSurface(surface: PriceSurface): PricingPortal {
  if (surface === 'store') return 'store'
  if (surface === 'business') return 'business'
  return 'corporate'
}

export const DEFAULT_SURFACES: Record<PriceSurface, SurfacePricing> = {
  crm: { useBestCost: false, showSellPrice: true },
  portal: { useBestCost: false, showSellPrice: true },
  microsite: { useBestCost: false, showSellPrice: true },
  store: { useBestCost: false, showSellPrice: true },
  business: { useBestCost: false, showSellPrice: true },
}

const SURFACE_COLUMNS: Record<PriceSurface, { use: string; show: string }> = {
  crm: { use: 'crm_use_best_cost', show: 'crm_show_sell_price' },
  portal: { use: 'portal_use_best_cost', show: 'portal_show_sell_price' },
  microsite: { use: 'microsite_use_best_cost', show: 'microsite_show_sell_price' },
  store: { use: 'store_use_best_cost', show: 'store_show_sell_price' },
  business: { use: 'business_use_best_cost', show: 'business_show_sell_price' },
}

export const SURFACE_SETTING_COLUMNS = [
  'best_cost_require_in_stock',
  ...Object.values(SURFACE_COLUMNS).flatMap((column) => [column.use, column.show]),
]

function flag(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value
  return fallback
}

export function pricingSettingsFromRow(
  row: Record<string, unknown> | null | undefined,
  margins: MarginSettings | null,
): PricingSettings {
  const surfaces = { ...DEFAULT_SURFACES }
  for (const surface of Object.keys(SURFACE_COLUMNS) as PriceSurface[]) {
    const column = SURFACE_COLUMNS[surface]
    surfaces[surface] = {
      useBestCost: flag(row?.[column.use], false),
      showSellPrice: flag(row?.[column.show], true),
    }
  }
  return {
    default_margin_percent: margins?.default_margin_percent ?? null,
    b2c_margin_percent: margins?.b2c_margin_percent ?? null,
    b2b_margin_percent: margins?.b2b_margin_percent ?? null,
    requireInStock: flag(row?.best_cost_require_in_stock, true),
    surfaces,
    portals: {
      store: portalRuleFromRow(row, 'store'),
      business: portalRuleFromRow(row, 'business'),
      corporate: portalRuleFromRow(row, 'corporate'),
    },
  }
}

export function supplierSchemaHint(message: string) {
  if (/public_contact_phone/i.test(message)) {
    return `${message} Apply supabase/migrations/20261016_company_product_prices.sql, then retry.`
  }
  if (/product_costs/i.test(message)) {
    return `${message} Apply supabase/migrations/20261013_product_costs.sql, then retry.`
  }
  if (/business_use_best_cost|business_show_sell_price|quote_validity_days|business_default_owner_id/i.test(message)) {
    return `${message} Apply the 20261012 business portal migrations, then retry.`
  }
  if (/portal_product_prices|price_change_log|portal_unit_price|store_price_base|corporate_margin_percent/i.test(message)) {
    return `${message} Apply supabase/migrations/20261021_pricing_engine.sql, then retry.`
  }
  if (/product_supplier_offers|quotation_item_costs|best_supplier_cost|use_best_cost|show_sell_price|best_cost_require_in_stock/i.test(message)) {
    return `${message} Apply supabase/migrations/20261005_supplier_offers.sql, then retry.`
  }
  return message
}
