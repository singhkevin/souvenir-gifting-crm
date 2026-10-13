/**
 * Catalogue visibility for shared catalogs, portal catalog lists, and kit prices.
 *
 * Company scope matches what a portal client can read:
 *   products_public_catalogue_select — active products with catalogue_access = 'all'
 *   products_client_granted_select — active catalogue_access = 'selected' rows the
 *   company was granted, and not excluded
 * plus the company_product_exclusions subtraction client_products applies to public
 * products. A product the company excluded is not visible to that company.
 *
 * Guest scope (no company) is the public catalogue only: active + catalogue_access = 'all'.
 */

export type VisibilityScope =
  | { kind: 'public' }
  | { kind: 'company'; companyId: string }

export type ProductVisibility = {
  status?: string | null
  catalogue_access?: string | null
}

export const HIDDEN_CATALOG_LINE_ERROR = 'One of the selected products is not available on this catalog'

export function productVisibleInScope(
  product: ProductVisibility,
  scope: VisibilityScope,
  access: { granted: boolean; excluded: boolean } = { granted: false, excluded: false },
): boolean {
  if (product.status !== 'active') return false
  if (scope.kind === 'public') return product.catalogue_access === 'all'
  if (access.excluded) return false
  if (product.catalogue_access === 'all') return true
  if (product.catalogue_access === 'selected') return access.granted
  return false
}

type CatalogVisibilityLine = {
  id: string
  product_id: string | null
  pack_kit_id: string | null
}

/** Drop products the viewer cannot see. A kit is dropped entirely when any member is hidden. */
export function visibleCatalogLines<T extends CatalogVisibilityLine>(
  lines: T[],
  visibleProductIds: ReadonlySet<string>,
): T[] {
  const hiddenKits = new Set<string>()
  for (const line of lines) {
    if (!line.pack_kit_id) continue
    if (!line.product_id || !visibleProductIds.has(line.product_id)) hiddenKits.add(line.pack_kit_id)
  }
  return lines.filter((line) => {
    if (!line.product_id || !visibleProductIds.has(line.product_id)) return false
    if (line.pack_kit_id && hiddenKits.has(line.pack_kit_id)) return false
    return true
  })
}

export function campaignIdsWithVisibleItems(
  lines: { campaign_id: string; product_id: string | null; pack_kit_id: string | null }[],
  visibleProductIds: ReadonlySet<string>,
): Set<string> {
  const byCampaign = new Map<string, { id: string; product_id: string | null; pack_kit_id: string | null }[]>()
  for (const line of lines) {
    const group = byCampaign.get(line.campaign_id) || []
    group.push({ id: line.product_id || line.campaign_id, product_id: line.product_id, pack_kit_id: line.pack_kit_id })
    byCampaign.set(line.campaign_id, group)
  }
  const keep = new Set<string>()
  for (const [campaignId, group] of byCampaign) {
    if (visibleCatalogLines(group, visibleProductIds).length) keep.add(campaignId)
  }
  return keep
}

/** True when a submitted line is on the catalog but not in the viewer's visible set. */
export function selectionIncludesHiddenLine(
  catalogLines: { id: string }[],
  visibleLines: { id: string }[],
  selected: { id: string }[],
): boolean {
  const known = new Set(catalogLines.map((line) => line.id))
  const visible = new Set(visibleLines.map((line) => line.id))
  return selected.some((line) => known.has(line.id) && !visible.has(line.id))
}

export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

/** Sum of member sell prices. Null when a member has no price, so the caller can fall back. */
export function kitDisplayTotal(members: { selling_price: number | null | undefined }[]): number | null {
  if (!members.length) return null
  let total = 0
  for (const member of members) {
    if (member.selling_price == null) return null
    const price = Number(member.selling_price)
    if (!Number.isFinite(price)) return null
    total += price
  }
  return roundMoney(total)
}

type PricedCatalogLine = {
  pack_kit_id: string | null
  pack_kit_role?: string | null
  selling_price: number | null
  pack_kit_total?: number | null
}

/**
 * Primary kit rows show the sum of the member prices in `lines` (the same rows a quote expands).
 * Line rows and standalone products are unchanged.
 */
export function withVisibleKitTotals<T extends PricedCatalogLine>(lines: T[]): T[] {
  const byKit = new Map<string, T[]>()
  for (const line of lines) {
    if (!line.pack_kit_id) continue
    const group = byKit.get(line.pack_kit_id) || []
    group.push(line)
    byKit.set(line.pack_kit_id, group)
  }
  return lines.map((line) => {
    if (!line.pack_kit_id || line.pack_kit_role === 'line') return line
    const total = kitDisplayTotal(byKit.get(line.pack_kit_id) || [line])
    return total == null ? line : { ...line, pack_kit_total: total }
  })
}

export function hiddenCatalogItemNames(
  items: { productId: string; name: string; status: string | null; catalogueAccess: string | null }[],
  access: { grantedIds: ReadonlySet<string>; excludedIds: ReadonlySet<string> },
): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of items) {
    if (seen.has(item.productId)) continue
    seen.add(item.productId)
    const visible = productVisibleInScope(
      { status: item.status, catalogue_access: item.catalogueAccess },
      { kind: 'company', companyId: '' },
      { granted: access.grantedIds.has(item.productId), excluded: access.excludedIds.has(item.productId) },
    )
    if (!visible) names.push(item.name || 'Item')
  }
  return names
}
