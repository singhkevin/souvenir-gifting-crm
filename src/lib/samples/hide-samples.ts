import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

/** Product ids marked sample-only. Empty when the column is missing or the lookup fails. */
export async function internalSampleProductIds(): Promise<string[]> {
  const admin = createAdminClient()
  if (!admin) return []
  const { data, error } = await admin.from('products').select('id').eq('sample_only', true)
  if (error || !data) return []
  return data.map((row) => String(row.id))
}

/** PostgREST `not.in` list. Null when there is nothing to hide. */
export function internalSampleNotIn(ids: readonly string[]): string | null {
  if (!ids.length) return null
  return `(${ids.join(',')})`
}
