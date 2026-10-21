import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { resolvePortalPrice, SEEDED_PORTAL_RULES } from '@/lib/pricing/engine'
import { getCompanyMarginPercent, getPricingSettings, resolveListedPrices, specialPricesForCompany } from '@/lib/pricing/server'
import type { PickerProduct } from '@/components/products/product-picker-drawer'

const PICKER_LIMIT = 1000

/**
 * Active products for the catalog and quotation pickers.
 * Price is the company special, or base price plus the company margin. Cost stays off this payload.
 */
export async function listCatalogPickerProducts(companyId: string | null): Promise<PickerProduct[]> {
  const supabase = await createClient()
  const [{ data: products }, companyMargin] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, price, moq, image_url, category:categories(name)')
      .eq('status', 'active')
      .order('name')
      .limit(PICKER_LIMIT),
    companyId ? getCompanyMarginPercent(companyId) : Promise.resolve(null),
  ])

  const rows = products || []
  const resolved = await resolveListedPrices(
    rows.map((row) => ({ id: row.id, retailPrice: row.price == null ? null : Number(row.price) })),
    'corporate',
    companyMargin,
    companyId,
  )
  const specials = resolved
    ? null
    : await specialPricesForCompany(supabase, companyId, rows.map((row) => row.id))
  const rule = resolved ? null : (await getPricingSettings()).portals.corporate

  return rows.map((row) => {
    const category = oneRelation(row.category as { name?: string | null } | { name?: string | null }[] | null)
    const fromEngine = resolved?.get(row.id)
    const special = specials?.get(row.id)
    const price = fromEngine
      ? fromEngine.price
      : resolvePortalPrice({
        portal: 'corporate',
        rule: rule || SEEDED_PORTAL_RULES.corporate,
        retailPrice: row.price,
        companyMarginPercent: companyMargin,
        specialPrice: special?.price,
        specialValidUntil: special?.validUntil,
      }).price
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      category: category?.name || null,
      price: price == null ? 0 : price,
      moq: row.moq && row.moq > 0 ? row.moq : 1,
    }
  })
}
