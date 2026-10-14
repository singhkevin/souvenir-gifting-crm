import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { listedUnitPrice } from '@/lib/pricing/listed'
import { getCompanyMarginPercent, specialPricesForCompany } from '@/lib/pricing/server'
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
  const specials = await specialPricesForCompany(supabase, companyId, rows.map((product) => product.id))

  return rows.map((row) => {
    const category = oneRelation(row.category as { name?: string | null } | { name?: string | null }[] | null)
    const special = specials.get(row.id)
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      category: category?.name || null,
      price: listedUnitPrice({
        specialPrice: special?.price,
        specialValidUntil: special?.validUntil,
        basePrice: row.price,
        companyMarginPercent: companyMargin,
      }),
      moq: row.moq && row.moq > 0 ? row.moq : 1,
    }
  })
}
