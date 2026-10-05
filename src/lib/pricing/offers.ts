export type SupplierOffer = {
  id: string
  product_id: string
  supplier_id: string
  supplier_name?: string | null
  supplier_sku: string | null
  cost: number
  moq: number
  lead_time_days: number | null
  in_stock: boolean
  is_active: boolean
  is_preferred: boolean
}

/** Preferred offer wins when it is eligible. Otherwise the lowest cost, then the shortest lead time. */
export function pickBestOffer(
  offers: SupplierOffer[],
  options: { quantity?: number | null; requireInStock: boolean },
): SupplierOffer | null {
  const quantity = options.quantity
  const eligible = offers.filter((offer) => {
    if (!offer.is_active) return false
    if (!Number.isFinite(offer.cost)) return false
    if (options.requireInStock && !offer.in_stock) return false
    if (quantity != null && quantity > 0 && offer.moq > quantity) return false
    return true
  })
  if (!eligible.length) return null
  const preferred = eligible.filter((offer) => offer.is_preferred)
  const pool = preferred.length ? preferred : eligible
  return [...pool].sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost
    return (a.lead_time_days ?? 99999) - (b.lead_time_days ?? 99999)
  })[0]
}

export function offersByProduct(offers: SupplierOffer[]) {
  const grouped = new Map<string, SupplierOffer[]>()
  for (const offer of offers) {
    const list = grouped.get(offer.product_id) || []
    list.push(offer)
    grouped.set(offer.product_id, list)
  }
  return grouped
}
