import 'server-only'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { portalUrlForSlug } from '@/lib/portal-host'
import { giftEmailProblem, giftWindowOpen } from '@/lib/gifts/rules'

export type GiftCompany = {
  id: string
  name: string
  slug: string | null
}

type SelectionRow = {
  id: string
  name: string
  allowed_email_domains: string[] | null
  opens_at: string
  closes_at: string
}

export function giftJoinUrl(slug: string | null) {
  const portal = portalUrlForSlug(slug)
  if (portal) return `${portal}/gift/join`
  if (slug) return `/gift/join?company=${encodeURIComponent(slug)}`
  return '/gift/join'
}

export async function resolveGiftCompany(slug?: string | null): Promise<GiftCompany | null> {
  const admin = createAdminClient()
  if (!admin) return null
  const headerStore = await headers()
  const tenant = readTenantFromHeaders(headerStore)
  if (tenant?.id) {
    const { data } = await admin
      .from('companies')
      .select('id, name, portal_slug, account_type')
      .eq('id', tenant.id)
      .maybeSingle()
    if (!data || data.account_type === 'direct') return null
    return { id: data.id, name: data.name, slug: data.portal_slug }
  }
  const clean = String(slug || '').trim().toLowerCase()
  if (!clean) return null
  const { data } = await admin
    .from('companies')
    .select('id, name, portal_slug, account_type')
    .eq('portal_slug', clean)
    .maybeSingle()
  if (!data || data.account_type === 'direct') return null
  return { id: data.id, name: data.name, slug: data.portal_slug }
}

export async function openGiftDomains(companyId: string): Promise<{ names: string[]; domains: string[] }> {
  const admin = createAdminClient()
  if (!admin) return { names: [], domains: [] }
  const { data } = await admin
    .from('gift_selections')
    .select('id, name, allowed_email_domains, opens_at, closes_at')
    .eq('company_id', companyId)
  const open = ((data || []) as SelectionRow[]).filter((row) => giftWindowOpen(row.opens_at, row.closes_at))
  const domains = [...new Set(open.flatMap((row) => row.allowed_email_domains || []).map((domain) => domain.toLowerCase()))]
  return { names: open.map((row) => row.name), domains }
}

export function signupEmailProblem(email: string, domains: string[]) {
  if (domains.length === 0) return 'Gift selection is not open right now.'
  return giftEmailProblem(email, domains)
}
