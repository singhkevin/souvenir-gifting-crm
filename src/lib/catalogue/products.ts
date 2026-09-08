import { createAdminClient } from '@/lib/supabase/admin'
import { oneRelation } from '@/lib/utils'
import { sortProductCategories } from '@/lib/products/categories'

const PUBLIC_PRODUCT_SELECT =
  'id, name, sku, description, image_url, price, moq, category_id, brand_id, status, created_at, category:categories(id, name), brand:brands(id, name)'

export type PublicProduct = {
  id: string
  name: string
  sku: string
  description: string | null
  image_url: string | null
  price: number | null
  moq: number | null
  category_id: string | null
  category_name: string | null
  brand_name: string | null
  status: string
  created_at: string | null
}

type Named = { id: string; name: string }

function toPublicProduct(row: {
  id: string
  name: string
  sku: string
  description: string | null
  image_url: string | null
  price: number | null
  moq: number | null
  category_id: string | null
  status: string
  created_at?: string | null
  category?: Named | Named[] | null
  brand?: Named | Named[] | null
}): PublicProduct {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    description: row.description,
    image_url: row.image_url,
    price: row.price,
    moq: row.moq,
    category_id: row.category_id,
    category_name: oneRelation(row.category)?.name || null,
    brand_name: oneRelation(row.brand)?.name || null,
    status: row.status,
    created_at: row.created_at || null,
  }
}

export async function getPublicCatalogueProducts(): Promise<PublicProduct[]> {
  const admin = createAdminClient()
  if (!admin) return []
  const { data, error } = await admin
    .from('products')
    .select(PUBLIC_PRODUCT_SELECT)
    .eq('status', 'active')
    .eq('catalogue_access', 'all')
    .order('name')
  if (error || !data) return []
  return data.map(toPublicProduct)
}

export async function getPublicProduct(id: string): Promise<PublicProduct | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('products')
    .select(PUBLIC_PRODUCT_SELECT)
    .eq('id', id)
    .eq('status', 'active')
    .eq('catalogue_access', 'all')
    .maybeSingle()
  if (error || !data) return null
  return toPublicProduct(data)
}

export async function getPublicCategories() {
  const products = await getPublicCatalogueProducts()
  const unique = Array.from(
    new Map(
      products
        .filter((product) => product.category_id && product.category_name)
        .map((product) => [product.category_id as string, product.category_name as string])
    ).entries()
  ).map(([id, name]) => ({ id, name }))
  return sortProductCategories(unique)
}

export function sanitiseCatalogueSearch(value: string) {
  return value.replace(/[,()*]/g, ' ').trim().slice(0, 80)
}
