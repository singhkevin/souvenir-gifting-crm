import { createClient } from '@/lib/supabase/server'
import { oneRelation } from '@/lib/utils'
import { getCompanyMarginPercent, resolveListedPrices } from '@/lib/pricing/server'
import type { PickerProduct } from '@/components/products/product-picker-drawer'

const PICKER_LIMIT = 1000

/**
 * Active products for the catalog and quotation pickers.
 * Price is the corporate price from the shared pricer (0 = price on quote). Cost stays off this payload.
 */
export async function listCatalogPickerProducts(companyId: string | null): Promise<PickerProduct[]> {
  const supabase = await createClient()
  const [productQuery, companyMargin] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, moq, stock_qty, image_url, category:categories(name)')
      .eq('status', 'active')
      .order('name')
      .limit(PICKER_LIMIT),
    companyId ? getCompanyMarginPercent(companyId) : Promise.resolve(null),
  ])
  const products = productQuery.error && /stock_qty/i.test(productQuery.error.message)
    ? (await supabase
        .from('products')
        .select('id, name, sku, moq, image_url, category:categories(name)')
        .eq('status', 'active')
        .order('name')
        .limit(PICKER_LIMIT)).data
    : productQuery.data

  const rows = products || []
  // Shared pricer: company special, fixed price, cost + margins. Falls back to this session's
  // client when the service role is not configured.
  const targets = rows.map((row) => ({ id: row.id }))
  const resolved = (await resolveListedPrices(targets, 'corporate', companyMargin, companyId))
    || (await resolveListedPrices(targets, 'corporate', companyMargin, companyId, undefined, supabase))

  return rows.map((row) => {
    const category = oneRelation(row.category as { name?: string | null } | { name?: string | null }[] | null)
    const price = resolved?.get(row.id)?.price ?? null
    const stockRaw = (row as { stock_qty?: number | null }).stock_qty
    const stock = stockRaw == null ? null : Number(stockRaw)
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      imageUrl: row.image_url,
      category: category?.name || null,
      price: price == null ? 0 : price,
      priced: price != null,
      moq: row.moq && row.moq > 0 ? row.moq : 1,
      stockQty: stock != null && Number.isFinite(stock) ? stock : null,
    }
  })
}
