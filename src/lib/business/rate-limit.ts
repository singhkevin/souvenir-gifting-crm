import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'

export async function allowRate(key: string, windowSeconds: number, max: number) {
  const admin = createAdminClient()
  if (!admin) return { ok: false, error: 'This action is unavailable just now. Please try again shortly.' }
  const { data, error } = await admin.rpc('hit_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  })
  if (error) {
    console.error('[rate-limit]', error.message)
    return { ok: false, error: 'This action is unavailable just now. Please try again shortly.' }
  }
  if (data !== true) return { ok: false, error: 'Too many attempts. Please try again later.' }
  return { ok: true }
}
