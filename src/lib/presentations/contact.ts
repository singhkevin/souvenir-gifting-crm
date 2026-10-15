import 'server-only'

import { appName } from '@/lib/brand'
import { resolvePublicContactPhone } from '@/lib/contact/public-phone'
import { createAdminClient } from '@/lib/supabase/admin'

/** Closing slide uses the public business contact. A blank phone stays blank. */
export async function publicDeckContact() {
  const fromEnv = process.env.PUBLIC_CONTACT_PHONE
  let organisation = appName()
  let phone = resolvePublicContactPhone(fromEnv, null)
  const admin = createAdminClient()
  if (!admin) return { organisation, phone }
  const { data, error } = await admin
    .from('org_settings')
    .select('organisation_name, public_contact_phone')
    .limit(1)
    .maybeSingle()
  if (error || !data) return { organisation, phone }
  const name = String(data.organisation_name || '').trim()
  if (name) organisation = name
  phone = resolvePublicContactPhone(fromEnv, data.public_contact_phone as string | null)
  return { organisation, phone }
}
