import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { pickAlertOwnerId } from '@/lib/alerts/owner-id'

export async function resolveAlertOwnerId(
  admin: SupabaseClient,
  ownerId: string | null | undefined,
): Promise<string | null> {
  let ownerActive: boolean | null = null
  if (ownerId) {
    const { data } = await admin.from('profiles').select('is_active').eq('id', ownerId).maybeSingle()
    ownerActive = data ? Boolean(data.is_active) : false
  }
  const { data: settings } = await admin.from('org_settings').select('business_default_owner_id').limit(1).maybeSingle()
  const fallback = settings?.business_default_owner_id ? String(settings.business_default_owner_id) : null
  const picked = pickAlertOwnerId({
    ownerId: ownerId ?? null,
    ownerActive,
    fallbackOwnerId: fallback,
  })
  if (!picked) return null
  if (picked === ownerId && ownerActive) return picked
  const { data: fallbackProfile } = await admin.from('profiles').select('is_active').eq('id', picked).maybeSingle()
  return fallbackProfile?.is_active ? picked : null
}
