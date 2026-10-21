import type { SupabaseClient } from '@supabase/supabase-js'

export async function recordPriceChange(
  client: SupabaseClient,
  entry: {
    actorId: string
    productId?: string | null
    companyId?: string | null
    portal?: string | null
    field: string
    oldValue: string | null
    newValue: string | null
  },
) {
  if ((entry.oldValue ?? '') === (entry.newValue ?? '')) return null
  const { error } = await client.from('price_change_log').insert({
    actor_id: entry.actorId,
    product_id: entry.productId || null,
    company_id: entry.companyId || null,
    portal: entry.portal || null,
    field: entry.field,
    old_value: entry.oldValue,
    new_value: entry.newValue,
  })
  if (error && /price_change_log|schema cache/i.test(error.message)) return null
  return error?.message || null
}
