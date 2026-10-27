import type { SupabaseClient } from '@supabase/supabase-js'
import { planOpeningSample } from '@/lib/samples/ledger'

/** True only when the sample ledger table or column is not in the database yet. */
export function sampleSchemaMissing(message: string) {
  return /schema cache|does not exist/i.test(message)
}

/** Create or top up in-office sample stock and log the receipt. No-op when nothing new was asked for. */
export async function syncOpeningSampleStock(
  supabase: SupabaseClient,
  input: {
    productId: string
    sampleOnly: boolean
    sampleQtyRaw: unknown
    unitCost: number | null
    actorId: string | null
  },
): Promise<{ error: string | null }> {
  const existing = await supabase
    .from('sample_stock')
    .select('id, in_office, unit_cost')
    .eq('product_id', input.productId)
    .maybeSingle()
  if (existing.error) {
    if (sampleSchemaMissing(existing.error.message)) return { error: null }
    return { error: existing.error.message }
  }

  const planned = planOpeningSample({
    sampleOnly: input.sampleOnly,
    sampleQtyRaw: input.sampleQtyRaw,
    stockExists: Boolean(existing.data),
  })
  if (!planned.ok) return { error: planned.error }
  if (!planned.ensureRow) return { error: null }

  const previousOffice = Number(existing.data?.in_office) || 0
  const storedCost =
    input.unitCost != null && Number.isFinite(input.unitCost) && input.unitCost >= 0
      ? input.unitCost
      : Number(existing.data?.unit_cost) || 0

  if (existing.data) {
    const { error } = await supabase
      .from('sample_stock')
      .update({
        in_office: previousOffice + planned.add,
        unit_cost: storedCost,
      })
      .eq('id', existing.data.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('sample_stock').insert({
      product_id: input.productId,
      in_office: planned.add,
      with_team: 0,
      with_client: 0,
      pending_supplier: 0,
      unit_cost: storedCost,
    })
    if (error) {
      if (sampleSchemaMissing(error.message)) return { error: null }
      return { error: error.message }
    }
  }

  if (planned.add < 1) return { error: null }

  const { error: movementError } = await supabase.from('sample_movements').insert({
    product_id: input.productId,
    quantity: planned.add,
    from_holder: 'supplier',
    to_holder: 'office',
    cost: storedCost,
    note: 'Initial sample receipt',
    created_by: input.actorId,
  })
  if (!movementError) return { error: null }

  if (existing.data) {
    await supabase.from('sample_stock').update({ in_office: previousOffice }).eq('id', existing.data.id)
  } else {
    await supabase.from('sample_stock').update({ in_office: 0 }).eq('product_id', input.productId)
  }
  return { error: movementError.message }
}
