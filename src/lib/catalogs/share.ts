import { createClient } from '@/lib/supabase/server'
import { isShareToken, shareLinkGrantsAccess, sharePath } from '@/lib/catalogs/share-link'

export { isShareToken, sharePath }

export type SharedCatalogProduct = {
  id: string
  product_id?: string | null
  sku?: string | null
  display_name: string | null
  client_description: string | null
  client_image_url: string | null
  selling_price: number | null
  moq: number | null
  pack_option: string | null
  pack_kit_id: string | null
  pack_kit_role: string | null
  pack_kit_total: number | null
  display_order: number | null
  stock_qty?: number | null
  fulfillment_mode?: string | null
}

export type SharedCatalog = {
  name: string
  occasion: string | null
  budget_per_employee: number | null
  expires_at: string | null
  products: SharedCatalogProduct[]
}

/** Public catalog payload. Null when the token is missing, revoked, or expired. */
export async function loadSharedCatalog(token: string): Promise<SharedCatalog | null> {
  if (!isShareToken(token)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_shared_catalog', { p_token: token })
  if (error || data == null) return null

  let payload: unknown = data
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload)
    } catch {
      return null
    }
  }
  if (!payload || typeof payload !== 'object') return null

  const row = payload as Partial<SharedCatalog>
  if (typeof row.name !== 'string' || !Array.isArray(row.products)) return null
  if (!shareLinkGrantsAccess({ expires_at: row.expires_at ?? null })) return null
  return {
    name: row.name,
    occasion: row.occasion ?? null,
    budget_per_employee: row.budget_per_employee == null ? null : Number(row.budget_per_employee),
    expires_at: row.expires_at ?? null,
    products: row.products,
  }
}
