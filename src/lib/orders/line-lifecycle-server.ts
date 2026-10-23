import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_LIFECYCLE_SETTINGS, mergeLifecycleSettings, type LifecycleSettings } from '@/lib/orders/line-lifecycle'

/** Postgres "undefined column/table" and PostgREST "not in schema cache" errors. */
export function isMissingSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false
  const code = String(error.code || '')
  if (code === '42703' || code === '42P01' || code === 'PGRST200' || code === 'PGRST202' || code === 'PGRST204' || code === 'PGRST205') {
    return true
  }
  return /does not exist|schema cache|could not find/i.test(String(error.message || ''))
}

/**
 * True once 20261023_order_line_lifecycle.sql is applied (order_items.stage exists).
 * Before that, every screen keeps the old order-level flow.
 */
export async function lineLifecycleEnabled(supabase: SupabaseClient): Promise<boolean> {
  if (process.env.ORDER_LINE_LIFECYCLE === 'off') return false
  const { error } = await supabase.from('order_items').select('stage').limit(1)
  if (!error) return true
  if (isMissingSchemaError(error)) return false
  // Any other error (RLS, network): treat as not available rather than breaking the page.
  return false
}

export async function loadLifecycleSettings(supabase: SupabaseClient): Promise<LifecycleSettings> {
  const { data, error } = await supabase.from('order_lifecycle_settings').select('settings').maybeSingle()
  if (error || !data) return DEFAULT_LIFECYCLE_SETTINGS
  return mergeLifecycleSettings(data.settings)
}

/** Customer emails for line-driven stage changes stay off unless explicitly switched on. */
export function lifecycleEmailsOn() {
  return process.env.ORDER_LIFECYCLE_EMAILS === 'on'
}

/** Short-lived links to proof files in the private order-proofs bucket (staff screens only). */
export async function signedProofUrls(paths: (string | null | undefined)[]) {
  const clean = Array.from(new Set(paths.filter((p): p is string => Boolean(p))))
  const out: Record<string, string> = {}
  if (!clean.length) return out
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()
  if (!admin) return out
  const { data } = await admin.storage.from('order-proofs').createSignedUrls(clean, 60 * 30)
  for (const row of data || []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl
  return out
}
