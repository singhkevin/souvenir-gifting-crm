import type { SupabaseClient } from '@supabase/supabase-js'

const MIGRATION = 'supabase/migrations/20261027_samples_internal.sql'

function hint(message: string) {
  if (/sample_stock|sample_movements|sample_balances/i.test(message)) {
    return `${message} Apply ${MIGRATION}, then retry.`
  }
  return message
}

/**
 * Creates the Samples row the first time a product is marked sample-only or given an initial quantity.
 * A later save does not add the quantity again.
 */
export async function seedSampleStock(
  supabase: SupabaseClient,
  input: { productId: string; quantity: number; unitCost: number; userId: string | null },
): Promise<{ error: string | null }> {
  const existing = await supabase.from('sample_stock').select('id').eq('product_id', input.productId).maybeSingle()
  if (existing.error) return { error: hint(existing.error.message) }
  if (existing.data) return { error: null }

  const quantity = Math.max(0, Math.trunc(input.quantity))
  const unitCost = Number.isFinite(input.unitCost) && input.unitCost > 0 ? input.unitCost : 0
  const inserted = await supabase
    .from('sample_stock')
    .insert({
      product_id: input.productId,
      in_office: quantity,
      with_team: 0,
      with_client: 0,
      pending_supplier: 0,
      unit_cost: unitCost,
    })
    .select('id')
    .single()
  if (inserted.error || !inserted.data) return { error: hint(inserted.error?.message || 'Sample stock was not created') }

  if (quantity < 1) return { error: null }

  const movement = await supabase.from('sample_movements').insert({
    product_id: input.productId,
    quantity,
    from_holder: 'supplier',
    to_holder: 'office',
    cost: unitCost,
    note: 'Initial sample receipt',
    created_by: input.userId,
  })
  if (movement.error) {
    await supabase.from('sample_stock').delete().eq('id', inserted.data.id)
    return { error: hint(movement.error.message) }
  }
  return { error: null }
}
