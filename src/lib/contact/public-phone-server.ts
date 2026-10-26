import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cachedPublicRead } from '@/lib/catalogue/public-read'
import { resolvePublicContactPhone } from '@/lib/contact/public-phone'

async function readSettingsPhone(): Promise<string | null> {
  const admin = createAdminClient()
  if (!admin) throw new Error('missing service role')
  const { data, error } = await admin.from('org_settings').select('public_contact_phone').limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.public_contact_phone as string | null) ?? null
}

const readCachedSettingsPhone = cachedPublicRead('public-contact-phone', readSettingsPhone)

/** Env wins and skips the database. Otherwise one cached org_settings read. */
export const getPublicContactPhone = cache(async (): Promise<string | null> => {
  const fromEnv = process.env.PUBLIC_CONTACT_PHONE
  if (String(fromEnv || '').trim()) return resolvePublicContactPhone(fromEnv, null)
  try {
    if (!createAdminClient()) {
      const supabase = await createClient()
      const { data } = await supabase.from('org_settings').select('public_contact_phone').limit(1).maybeSingle()
      return resolvePublicContactPhone(null, (data?.public_contact_phone as string | null) ?? null)
    }
    return resolvePublicContactPhone(null, await readCachedSettingsPhone())
  } catch {
    return null
  }
})
