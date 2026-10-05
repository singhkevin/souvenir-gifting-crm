import { createClient } from '@/lib/supabase/server'
import { getCompanyMarginPercent, getPricingSettings, loadSupplierOffers, supplierCostForProduct } from '@/lib/pricing/server'
import { offersByProduct } from '@/lib/pricing/offers'
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
      .select('id, name, sku, price, moq, supplier_cost, internal_margin')
      .eq('status', 'active')
      .order('name')
      .limit(PICKER_LIMIT),
    getPricingSettings(),
    companyId ? getCompanyMarginPercent(companyId) : Promise.resolve(null),
  ])

  const rows = products || []
  const offers = settings.surfaces.portal.useBestCost
    ? offersByProduct(await loadSupplierOffers(supabase, rows.map((product) => product.id)))
    : new Map()

  return rows.map((product) => {
    const resolved = resolveSellPrice({
      supplierCost: supplierCostForProduct(product, offers.get(product.id) || [], {
        useBestCost: settings.surfaces.portal.useBestCost,
        requireInStock: settings.requireInStock,
        quantity: product.moq,
      }),
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
