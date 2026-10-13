export type CatalogRfqLine = {
  id: string
  quantity: number
}

export type ExpandedRfqLine = {
  product_id: string
  quantity: number
  sku: string | null
  name: string | null
}

type CatalogProductEmbed = {
  sku?: string | null
  name?: string | null
  status?: string | null
}

export type CatalogLineRow = {
  id: string
  product_id: string
  pack_kit_id: string | null
  pack_kit_role: string | null
  moq: number | null
  product?: CatalogProductEmbed | CatalogProductEmbed[] | null
}

function embedProduct(product: CatalogLineRow['product']) {
  return Array.isArray(product) ? product[0] : product
}

/**
 * Selected catalog offerings become one quantity per SKU.
 * A kit selection includes every member present in `rows`.
 * Pass only lines the viewer can see (hide a kit when any member is hidden)
 * so the requested products are the ones whose prices were summed for display.
 */
export function expandCatalogRfqLines(
  rows: CatalogLineRow[],
  selected: CatalogRfqLine[],
): { error?: string; lines?: ExpandedRfqLine[] } {
  if (!selected.length) return { error: 'Select at least one product' }
  const byId = new Map(rows.map((row) => [row.id, row]))
  const qtyByProduct = new Map<string, ExpandedRfqLine>()

  for (const line of selected) {
    const row = byId.get(line.id)
    if (!row?.product_id) return { error: 'One of the selected products is not on this catalog' }
    const product = embedProduct(row.product)
    const label = product?.name || 'A product'
    const moq = row.moq && row.moq > 0 ? Math.round(row.moq) : 1
    if (line.quantity < moq || line.quantity > 100000) {
      return { error: `Quantity for ${label} must be a whole number from ${moq} to 100000` }
    }
    const members = row.pack_kit_id ? rows.filter((candidate) => candidate.pack_kit_id === row.pack_kit_id) : [row]
    for (const member of members.length ? members : [row]) {
      if (!member.product_id) continue
      const memberProduct = embedProduct(member.product)
      const current = qtyByProduct.get(member.product_id)
      qtyByProduct.set(member.product_id, {
        product_id: member.product_id,
        quantity: (current?.quantity || 0) + line.quantity,
        sku: memberProduct?.sku || current?.sku || null,
        name: memberProduct?.name || current?.name || null,
      })
    }
  }

  if (!qtyByProduct.size) return { error: 'Select at least one product' }
  return { lines: [...qtyByProduct.values()] }
}
