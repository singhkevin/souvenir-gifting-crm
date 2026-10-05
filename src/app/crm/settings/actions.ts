'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { supplierSchemaHint } from '@/lib/pricing/surfaces'

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
  const payload = {
    organisation_name: String(formData.get('organisation_name') || '') || null,
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
  }

  const { data: existing } = await supabase.from('org_settings').select('id').limit(1).maybeSingle()
  const error = existing
    ? (await supabase.from('org_settings').update(payload).eq('id', existing.id)).error
    : (await supabase.from('org_settings').insert(payload)).error
  if (error) return { error: supplierSchemaHint(error.message) }
  revalidatePath('/crm/settings')
  return { success: true }
}
