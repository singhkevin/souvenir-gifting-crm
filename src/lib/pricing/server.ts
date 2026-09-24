import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  resolveSellPrice,
  type MarginSettings,
  type PriceChannel,
  type ResolvedPrice,
} from '@/lib/pricing/resolve'

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
