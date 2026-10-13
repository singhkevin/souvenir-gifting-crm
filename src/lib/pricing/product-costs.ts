import type { SupabaseClient } from '@supabase/supabase-js'

/** Staff-only cost row. PostgREST embed name for products.product_id. */
export const PRODUCT_COST_EMBED = 'product_costs(supplier_cost, internal_margin, internal_notes)'

export type ProductCostFields = {
  supplier_cost: number | null
  internal_margin: number | null
  internal_notes: string | null
}

type CostRelation = {
  product_costs?: Partial<ProductCostFields> | Partial<ProductCostFields>[] | null
}

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function readProductCost(row: CostRelation | null | undefined): ProductCostFields {
  const raw = row?.product_costs
  const cost = Array.isArray(raw) ? raw[0] : raw
  return {
    supplier_cost: asNumber(cost?.supplier_cost),
    internal_margin: asNumber(cost?.internal_margin),
    internal_notes: cost?.internal_notes ?? null,
  }
}

export function withProductCost<T extends object>(row: T): T & ProductCostFields {
  return { ...row, ...readProductCost(row as CostRelation) }
}

export async function upsertProductCost(
  client: SupabaseClient,
  productId: string,
  fields: Partial<ProductCostFields>,
) {
  const payload: Record<string, unknown> = {
    product_id: productId,
    updated_at: new Date().toISOString(),
  }
  if ('supplier_cost' in fields) payload.supplier_cost = fields.supplier_cost
  if ('internal_margin' in fields) payload.internal_margin = fields.internal_margin
  if ('internal_notes' in fields) payload.internal_notes = fields.internal_notes
  return client.from('product_costs').upsert(payload)
}
