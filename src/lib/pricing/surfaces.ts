import type { MarginSettings } from '@/lib/pricing/resolve'

export type PriceSurface = 'crm' | 'portal' | 'microsite' | 'store'

export type SurfacePricing = {
  useBestCost: boolean
  showSellPrice: boolean
}

export type PricingSettings = MarginSettings & {
  requireInStock: boolean
  surfaces: Record<PriceSurface, SurfacePricing>
}

export const DEFAULT_SURFACES: Record<PriceSurface, SurfacePricing> = {
  crm: { useBestCost: false, showSellPrice: true },
  portal: { useBestCost: false, showSellPrice: true },
  microsite: { useBestCost: false, showSellPrice: true },
  store: { useBestCost: false, showSellPrice: true },
}

const SURFACE_COLUMNS: Record<PriceSurface, { use: string; show: string }> = {
  crm: { use: 'crm_use_best_cost', show: 'crm_show_sell_price' },
  portal: { use: 'portal_use_best_cost', show: 'portal_show_sell_price' },
  microsite: { use: 'microsite_use_best_cost', show: 'microsite_show_sell_price' },
  store: { use: 'store_use_best_cost', show: 'store_show_sell_price' },
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
  }
}

export function supplierSchemaHint(message: string) {
  if (/product_supplier_offers|quotation_item_costs|best_supplier_cost|use_best_cost|show_sell_price|best_cost_require_in_stock/i.test(message)) {
    return `${message} Apply supabase/migrations/20261005_supplier_offers.sql, then retry.`
  }
  return message
}
