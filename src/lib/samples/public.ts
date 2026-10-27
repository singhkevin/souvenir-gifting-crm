import type { SupabaseClient } from '@supabase/supabase-js'

/** Product ids marked sample-only. Empty when the column is missing or the caller cannot see the row. */
export async function sampleOnlyProductIds(supabase: SupabaseClient, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Set()
  const { data, error } = await supabase.from('products').select('id, sample_only').in('id', unique)
  if (error || !data) return new Set()
  return new Set(
    data.filter((row) => (row as { sample_only?: boolean | null }).sample_only === true).map((row) => String((row as { id: string }).id)),
  )
}
