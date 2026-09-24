import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getMarginSettings, resolveProductSellPrice } from '@/lib/pricing/server'
import { pickBudgetPackKits, type BudgetPackCandidate } from '@/lib/catalogue/budget-packs'

type ProductRow = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price: number | null
  moq: number | null
  supplier_cost: number | null
  internal_margin: number | null
  catalogue_access: string
  status: string
}

async function db() {
  return createAdminClient() || (await createClient())
}

/** Products this company may see in portal (same rules as client_products). */
export async function loadCompanyCatalogueProducts(companyId: string): Promise<ProductRow[]> {
  const client = await db()
  const { data: grants } = await client
    .from('company_product_access')
    .select('product_id')
    .eq('company_id', companyId)

  const grantedIds = new Set((grants || []).map((g) => g.product_id))

  const { data: products, error } = await client
    .from('products')
    .select(
      'id, name, description, image_url, price, moq, supplier_cost, internal_margin, catalogue_access, status'
    )
    .eq('status', 'active')
    .neq('catalogue_access', 'none')

  if (error || !products) return []

  return products.filter(
    (p) => p.catalogue_access === 'all' || grantedIds.has(p.id)
  ) as ProductRow[]
}

export async function buildBudgetPackCandidates(
  companyId: string,
  budgetPerPerson: number
): Promise<{ candidates: BudgetPackCandidate[]; priced: Map<string, ProductRow & { sellPrice: number }> }> {
  const products = await loadCompanyCatalogueProducts(companyId)
  const settings = await getMarginSettings()
  const priced = new Map<string, ProductRow & { sellPrice: number }>()
  const candidates: BudgetPackCandidate[] = []

  for (const product of products) {
    const resolved = await resolveProductSellPrice(product, {
      channel: 'b2b',
      companyId,
      settings,
    })
    if (resolved.sellPrice <= 0) continue
    // Individual line items may exceed budget alone; kit total must not.
    priced.set(product.id, { ...product, sellPrice: resolved.sellPrice })
    candidates.push({ id: product.id, name: product.name, sellPrice: resolved.sellPrice })
  }

  return { candidates, priced }
}

export function planBudgetPacks(candidates: BudgetPackCandidate[], budgetPerPerson: number) {
  return pickBudgetPackKits(candidates, budgetPerPerson, 3)
}
