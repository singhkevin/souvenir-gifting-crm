import 'server-only'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { portalUrlForSlug, tenantPortalUrl } from '@/lib/portal-host'
import { isGiftEmployeeRole } from '@/lib/roles'

export function crossesHost(destination: string) {
  return destination.startsWith('http://') || destination.startsWith('https://')
}

/** Where a company microsite account belongs. Absolute when the split is on and the company has a slug. */
export async function micrositeHome(companyId: string | null, role: string): Promise<string> {
  const gift = isGiftEmployeeRole(role)
  const fallback = gift ? '/gift' : '/portal/gifts'
  if (!domainSplitEnabled() || !companyId) return fallback
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('portal_slug').eq('id', companyId).maybeSingle()
  const slug = data?.portal_slug || null
  if (!slug) return fallback
  if (gift) {
    const base = portalUrlForSlug(slug)
    return base ? `${base}/gift` : fallback
  }
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  return tenantPortalUrl(slug, host) || fallback
}

/**
 * Leave /business (or the retail host) for the company microsite.
 * With the domain split on, the session on this host is cleared so a portal account
 * is not left signed in on the store.
 */
export async function redirectToMicrosite(companyId: string | null, role: string): Promise<never> {
  const dest = await micrositeHome(companyId, role)
  if (domainSplitEnabled()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
    if (!crossesHost(dest)) redirect('/login?error=portal')
  }
  redirect(dest)
}
