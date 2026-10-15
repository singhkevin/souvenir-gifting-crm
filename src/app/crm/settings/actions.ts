'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { supplierSchemaHint } from '@/lib/pricing/surfaces'
import { normalizeEmailDomain } from '@/lib/pricing/domains'

export async function updateOrgSettings(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return { error: 'Admin only' }

  const readMargin = (key: string) => {
    const raw = String(formData.get(key) || '').trim()
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return null
    return n
  }

  const checked = (key: string) => formData.get(key) === 'on'
  const readDays = (key: string) => {
    const n = Number(formData.get(key))
    if (!Number.isInteger(n) || n < 1 || n > 90) return 14
    return n
  }
  const payload = {
    organisation_name: String(formData.get('organisation_name') || '') || null,
    public_contact_phone: String(formData.get('public_contact_phone') || '').trim() || null,
    default_tax_percent: formData.get('default_tax_percent') ? Number(formData.get('default_tax_percent')) : null,
    currency: String(formData.get('currency') || 'INR'),
    default_margin_percent: readMargin('default_margin_percent'),
    b2c_margin_percent: readMargin('b2c_margin_percent'),
    b2b_margin_percent: readMargin('b2b_margin_percent'),
    best_cost_require_in_stock: checked('best_cost_require_in_stock'),
    crm_use_best_cost: checked('crm_use_best_cost'),
    crm_show_sell_price: checked('crm_show_sell_price'),
    portal_use_best_cost: checked('portal_use_best_cost'),
    portal_show_sell_price: checked('portal_show_sell_price'),
    microsite_use_best_cost: checked('microsite_use_best_cost'),
    microsite_show_sell_price: checked('microsite_show_sell_price'),
    store_use_best_cost: checked('store_use_best_cost'),
    store_show_sell_price: checked('store_show_sell_price'),
    business_use_best_cost: checked('business_use_best_cost'),
    business_show_sell_price: checked('business_show_sell_price'),
    quote_validity_days: readDays('quote_validity_days'),
    business_default_owner_id: String(formData.get('business_default_owner_id') || '') || null,
  }

  const { data: existing } = await supabase.from('org_settings').select('id').limit(1).maybeSingle()
  const error = existing
    ? (await supabase.from('org_settings').update(payload).eq('id', existing.id)).error
    : (await supabase.from('org_settings').insert(payload)).error
  if (error) return { error: supplierSchemaHint(error.message) }
  revalidatePath('/crm/settings')
  return { success: true }
}

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return { error: 'Admin only' as const }
  return { supabase }
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
