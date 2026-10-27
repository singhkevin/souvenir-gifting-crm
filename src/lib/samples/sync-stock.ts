import type { SupabaseClient } from '@supabase/supabase-js'
import { planInitialSampleStock } from '@/lib/samples/ledger'

/**
 * Creates the office sample row (and the first receipt) when a product is saved
 * as sample-only or with an initial sample quantity. Safe to call again: a blank
 * quantity does not add more pieces once the row exists.
 */
export async function syncSampleStock(
  supabase: SupabaseClient,
  input: {
    productId: string
    sampleOnly: boolean
    initialQty: number | null
    stockQty: number
    unitCost: number | null
    userId: string
  },
): Promise<string | null> {
  const existingResult = await supabase
    .from('sample_stock')
    .select('id, in_office, unit_cost')
    .eq('product_id', input.productId)
    .maybeSingle()
  if (existingResult.error) {
    if (/sample_stock|schema cache|does not exist/i.test(existingResult.error.message)) return null
    return existingResult.error.message
  }

  const existing = existingResult.data as { id: string; in_office: number | null; unit_cost: number | null } | null
  const plan = planInitialSampleStock({
    sampleOnly: input.sampleOnly,
    initialQty: input.initialQty,
    stockQty: input.stockQty,
    existingInOffice: existing ? Number(existing.in_office || 0) : null,
  })
  if (plan.action === 'skip') return null
  if (plan.action === 'error') return plan.error

  const unitCost = input.unitCost != null && input.unitCost > 0 ? input.unitCost : Number(existing?.unit_cost || 0)
  if (!existing) {
    const inserted = await supabase.from('sample_stock').insert({
      product_id: input.productId,
      in_office: plan.addQty,
      with_team: 0,
      with_client: 0,
      pending_supplier: 0,
      unit_cost: unitCost,
    })
    if (inserted.error) return inserted.error.message
  } else if (plan.addQty > 0) {
    const updated = await supabase
      .from('sample_stock')
      .update({
        in_office: Number(existing.in_office || 0) + plan.addQty,
        unit_cost: unitCost || existing.unit_cost || 0,
      })
      .eq('id', existing.id)
    if (updated.error) return updated.error.message
  }

  if (plan.addQty > 0) {
    const movement = await supabase.from('sample_movements').insert({
      product_id: input.productId,
      quantity: plan.addQty,
      from_holder: 'supplier',
      to_holder: 'office',
      cost: unitCost,
      note: 'Initial sample receipt',
      created_by: input.userId,
    })
    if (movement.error) {
      if (!existing) {
        await supabase.from('sample_stock').delete().eq('product_id', input.productId)
      } else {
        await supabase.from('sample_stock').update({
          in_office: Number(existing.in_office || 0),
          unit_cost: existing.unit_cost || 0,
        }).eq('id', existing.id)
      }
      return movement.error.message
    }
  }
  return null
}
