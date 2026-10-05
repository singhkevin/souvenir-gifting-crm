import { createClient } from '@/lib/supabase/server'
import { getCompanyMarginPercent, getMarginSettings } from '@/lib/pricing/server'
import { resolveSellPrice } from '@/lib/pricing/resolve'

export type CatalogPickerProduct = {
  id: string
  name: string
  sku: string
  sellPrice: number
}

const PICKER_LIMIT = 1000

/**
 * Active products with the same B2B client sell price the catalog builder saves.
 * Supplier cost and margin never leave the server.
 */
export async function listCatalogPickerProducts(companyId: string | null): Promise<CatalogPickerProduct[]> {
  const supabase = await createClient()
  const [{ data: products }, settings, companyMargin] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, price, supplier_cost, internal_margin')
      .eq('status', 'active')
      .order('name')
      .limit(PICKER_LIMIT),
    getMarginSettings(),
    companyId ? getCompanyMarginPercent(companyId) : Promise.resolve(null),
  ])

  return (products || []).map((product) => {
    const resolved = resolveSellPrice({
      supplierCost: product.supplier_cost,
      listPrice: product.price,
      productMarginPercent: product.internal_margin,
      companyMarginPercent: companyMargin,
      channel: 'b2b',
      settings,
    })
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      sellPrice: resolved.sellPrice,
    }
  })
}
