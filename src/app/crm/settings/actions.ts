'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAudit } from '@/lib/audit'
import { emailDomainRuleChoice } from '@/lib/business/email-domain'
import { invalidatePublicCatalogue } from '@/lib/catalogue/public-read'
import { normalizeEmailDomain } from '@/lib/pricing/domains'

export async function updateOrgSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return { error: 'Admin only' }

  const readDays = (key: string) => {
    const n = Number(formData.get(key))
    if (!Number.isInteger(n) || n < 1 || n > 90) return 14
    return n
  }
  const storeOwner = String(formData.get('store_default_owner_id') || '') || null
  const payload: Record<string, string | number | null> = {
    organisation_name: String(formData.get('organisation_name') || '') || null,
    public_contact_phone: String(formData.get('public_contact_phone') || '').trim() || null,
    default_tax_percent: formData.get('default_tax_percent') ? Number(formData.get('default_tax_percent')) : null,
    currency: String(formData.get('currency') || 'INR'),
    quote_validity_days: readDays('quote_validity_days'),
    business_default_owner_id: String(formData.get('business_default_owner_id') || '') || null,
    store_default_owner_id: storeOwner,
  }

  const { data: existing } = await supabase.from('org_settings').select('id').limit(1).maybeSingle()
  const save = (body: Record<string, string | number | null>) =>
    existing
      ? supabase.from('org_settings').update(body).eq('id', existing.id)
      : supabase.from('org_settings').insert(body)
  let error = (await save(payload)).error
  if (error && /store_default_owner_id/i.test(error.message)) {
    if (storeOwner) {
      return { error: `${error.message} Apply supabase/migrations/20261022_channel_order_visibility.sql, then retry.` }
    }
    const rest = { ...payload }
    delete rest.store_default_owner_id
    error = (await save(rest)).error
  }
  if (error) return { error: error.message }
  invalidatePublicCatalogue()
  revalidatePath('/crm/settings')
  return { success: true }
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return { error: 'Admin only' as const }
  return { supabase, userId: user.id }
}

export async function saveEmailDomainRule(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const domain = normalizeEmailDomain(String(formData.get('domain') || ''))
  if (!domain) return { error: 'Enter a domain such as acme.com' }
  const rule = emailDomainRuleChoice(String(formData.get('rule') || ''))
  if (!rule) return { error: 'Choose allow, block free, or block disposable' }
  const note = String(formData.get('note') || '').trim() || null
  const previous = await auth.supabase.from('email_domain_rules').select('domain, rule, note').eq('domain', domain).maybeSingle()
  const { error } = await auth.supabase.from('email_domain_rules').upsert({
    domain,
    rule,
    note,
    created_by: auth.userId,
  })
  if (error) {
    if (/email_domain_rules/i.test(error.message)) {
      return { error: 'Apply supabase/migrations/20261030b_business_email_domains.sql, then retry.' }
    }
    return { error: error.message }
  }
  await writeAudit(auth.supabase, {
    action: 'update',
    entity: 'email_domain_rules',
    entityId: null,
    previous: previous.data,
    next: { domain, rule, note },
    userId: auth.userId,
  })
  revalidatePath('/crm/settings')
  return { success: true }
}

export async function removeEmailDomainRule(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const domain = normalizeEmailDomain(String(formData.get('domain') || ''))
  if (!domain) return { error: 'Domain not found' }
  const previous = await auth.supabase.from('email_domain_rules').select('domain, rule, note').eq('domain', domain).maybeSingle()
  const { error } = await auth.supabase.from('email_domain_rules').delete().eq('domain', domain)
  if (error) return { error: error.message }
  await writeAudit(auth.supabase, {
    action: 'delete',
    entity: 'email_domain_rules',
    previous: previous.data,
    next: null,
    userId: auth.userId,
  })
  revalidatePath('/crm/settings')
  return { success: true }
}

export async function addEmailDomainAllowlist(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const domain = normalizeEmailDomain(String(formData.get('domain') || ''))
  if (!domain) return { error: 'Enter a domain such as acme.com' }
  const { error } = await auth.supabase.from('email_domain_allowlist').insert({
    domain,
    note: String(formData.get('note') || '').trim() || null,
  })
  if (error) {
    if (error.code === '23505') return { error: 'That domain is already allowed' }
    if (/email_domain_allowlist/i.test(error.message)) {
      return { error: 'Apply supabase/migrations/20261018_registration_pricing_samples.sql, then retry.' }
    }
    return { error: error.message }
  }
  revalidatePath('/crm/settings')
  return { success: true }
}

export async function removeEmailDomainAllowlist(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth
  const domain = normalizeEmailDomain(String(formData.get('domain') || ''))
  if (!domain) return { error: 'Domain not found' }
  const { error } = await auth.supabase.from('email_domain_allowlist').delete().eq('domain', domain)
  if (error) return { error: error.message }
  revalidatePath('/crm/settings')
  return { success: true }
}
