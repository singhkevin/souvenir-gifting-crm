import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  campaignIdsWithVisibleItems,
  hiddenCatalogItemNames,
  productVisibleInScope,
  visibleCatalogLines,
  type VisibilityScope,
} from '@/lib/catalogs/visibility'

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>

async function visibleProductIds(
  admin: AdminClient,
  productIds: string[],
  scope: VisibilityScope,
): Promise<Set<string> | null> {
  const ids = [...new Set(productIds.filter(Boolean))]
  if (!ids.length) return new Set()
  const { data: products, error } = await admin
    .from('products')
    .select('id, status, catalogue_access')
    .in('id', ids)
  if (error || !products) return null

  const granted = new Set<string>()
  const excluded = new Set<string>()
  if (scope.kind === 'company') {
    const [{ data: grantRows, error: grantError }, { data: exclusionRows, error: exclusionError }] = await Promise.all([
      admin.from('company_product_access').select('product_id').eq('company_id', scope.companyId).in('product_id', ids),
      admin.from('company_product_exclusions').select('product_id').eq('company_id', scope.companyId).in('product_id', ids),
    ])
    if (grantError || exclusionError) return null
    for (const row of grantRows || []) granted.add(row.product_id as string)
    for (const row of exclusionRows || []) excluded.add(row.product_id as string)
  }

  const visible = new Set<string>()
  for (const product of products) {
    if (productVisibleInScope(product, scope, {
      granted: granted.has(product.id as string),
      excluded: excluded.has(product.id as string),
    })) {
      visible.add(product.id as string)
    }
  }
  return visible
}

/** Published catalog line ids the scope can see. Null when visibility cannot be checked. */
export async function displayableLineIds(
  campaignId: string,
  scope: VisibilityScope,
): Promise<Set<string> | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('campaign_products')
    .select('id, product_id, pack_kit_id')
    .eq('campaign_id', campaignId)
    .eq('visibility', 'published')
  if (error || !data) return null
  const visibleProducts = await visibleProductIds(
    admin,
    data.map((row) => row.product_id as string),
    scope,
  )
  if (!visibleProducts) return null
  return new Set(visibleCatalogLines(
    data.map((row) => ({
      id: row.id as string,
      product_id: (row.product_id as string | null) ?? null,
      pack_kit_id: (row.pack_kit_id as string | null) ?? null,
    })),
    visibleProducts,
  ).map((row) => row.id))
}

/**
 * Guest share links use the link's company when one is set, otherwise the public catalogue.
 * A signed-in client always uses their own company, even when the link names another.
 */
export async function shareCatalogVisibilityScope(input: {
  token: string
  viewerIsClient: boolean
  viewerCompanyId: string | null
}): Promise<VisibilityScope> {
  if (input.viewerIsClient) {
    return input.viewerCompanyId ? { kind: 'company', companyId: input.viewerCompanyId } : { kind: 'public' }
  }
  const admin = createAdminClient()
  if (!admin) return { kind: 'public' }
  const { data, error } = await admin
    .from('catalog_share_links')
    .select('company_id')
    .eq('token', input.token)
    .maybeSingle()
  if (error || !data?.company_id) return { kind: 'public' }
  return { kind: 'company', companyId: data.company_id as string }
}

/** Drop catalogs whose published lines are all hidden from this company. Keeps the list when the check cannot run. */
export async function catalogsWithVisibleItems<T extends { id: string }>(
  companyId: string,
  catalogs: T[],
): Promise<T[]> {
  if (!catalogs.length) return catalogs
  const admin = createAdminClient()
  if (!admin) return catalogs
  const ids = catalogs.map((catalog) => catalog.id)
  const { data, error } = await admin
    .from('campaign_products')
    .select('campaign_id, product_id, pack_kit_id')
    .in('campaign_id', ids)
    .eq('visibility', 'published')
  if (error || !data) return catalogs
  const visibleProducts = await visibleProductIds(
    admin,
    data.map((row) => row.product_id as string),
    { kind: 'company', companyId },
  )
  if (!visibleProducts) return catalogs
  const keep = campaignIdsWithVisibleItems(
    data.map((row) => ({
      campaign_id: row.campaign_id as string,
      product_id: (row.product_id as string | null) ?? null,
      pack_kit_id: (row.pack_kit_id as string | null) ?? null,
    })),
    visibleProducts,
  )
  return catalogs.filter((catalog) => keep.has(catalog.id))
}

export async function hiddenCatalogItemsByCompany(
  companyIds: string[],
  items: { productId: string; name: string }[],
): Promise<{ companyId: string; names: string[] }[]> {
  const companies = [...new Set(companyIds.filter(Boolean))]
  const unique = new Map<string, string>()
  for (const item of items) {
    if (item.productId && !unique.has(item.productId)) unique.set(item.productId, item.name)
  }
  if (!companies.length || !unique.size) return []
  const admin = createAdminClient()
  if (!admin) return []
  const productIds = [...unique.keys()]
  const [{ data: products, error: productError }, { data: grantRows, error: grantError }, { data: exclusionRows, error: exclusionError }] = await Promise.all([
    admin.from('products').select('id, status, catalogue_access').in('id', productIds),
    admin.from('company_product_access').select('company_id, product_id').in('product_id', productIds).in('company_id', companies),
    admin.from('company_product_exclusions').select('company_id, product_id').in('product_id', productIds).in('company_id', companies),
  ])
  if (productError || grantError || exclusionError || !products) return []

  const byId = new Map(products.map((product) => [product.id as string, product]))
  const grantsByCompany = new Map<string, Set<string>>()
  const exclusionsByCompany = new Map<string, Set<string>>()
  for (const row of grantRows || []) {
    const companyId = row.company_id as string
    const set = grantsByCompany.get(companyId) || new Set<string>()
    set.add(row.product_id as string)
    grantsByCompany.set(companyId, set)
  }
  for (const row of exclusionRows || []) {
    const companyId = row.company_id as string
    const set = exclusionsByCompany.get(companyId) || new Set<string>()
    set.add(row.product_id as string)
    exclusionsByCompany.set(companyId, set)
  }

  const catalogItems = [...unique.entries()].map(([productId, name]) => {
    const product = byId.get(productId)
    return {
      productId,
      name,
      status: (product?.status as string | null) ?? null,
      catalogueAccess: (product?.catalogue_access as string | null) ?? null,
    }
  })

  return companies.flatMap((companyId) => {
    const names = hiddenCatalogItemNames(catalogItems, {
      grantedIds: grantsByCompany.get(companyId) || new Set(),
      excludedIds: exclusionsByCompany.get(companyId) || new Set(),
    })
    return names.length ? [{ companyId, names }] : []
  })
}
