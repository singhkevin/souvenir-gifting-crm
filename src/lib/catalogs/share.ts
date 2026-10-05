import { createClient } from '@/lib/supabase/server'

export type SharedCatalogProduct = {
  id: string
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
}

export type SharedCatalog = {
  name: string
  occasion: string | null
  budget_per_employee: number | null
  expires_at: string | null
  products: SharedCatalogProduct[]
}

export function isShareToken(value: string) {
  return /^[A-Za-z0-9_-]{16,128}$/.test(value)
}

export function sharePath(token: string) {
  return `/share/catalogs/${token}`
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
  return {
    name: row.name,
    occasion: row.occasion ?? null,
    budget_per_employee: row.budget_per_employee == null ? null : Number(row.budget_per_employee),
    expires_at: row.expires_at ?? null,
    products: row.products,
  }
}
