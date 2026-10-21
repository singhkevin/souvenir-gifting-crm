'use server'

import { revalidatePath } from 'next/cache'
import { recordPriceChange } from '@/lib/pricing/audit'
import { fixedPriceBlockReason } from '@/lib/pricing/engine'
import { getPricingSettings } from '@/lib/pricing/server'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

const PRICING_ROLES = ['admin', 'sales', 'management', 'accounts']

async function requirePricing() {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (!PRICING_ROLES.includes(profile.role)) return { error: 'Not permitted to set special prices' as const }
  return { profile }
}

export async function saveCompanySpecialPrice(formData: FormData) {
  const access = await requirePricing()
  if ('error' in access) return { error: access.error }
  const companyId = String(formData.get('company_id') || '')
  const productId = String(formData.get('product_id') || '')
  const price = Number(formData.get('price'))
  const until = String(formData.get('valid_until') || '').trim()
  if (!isUuid(companyId) || !isUuid(productId)) return { error: 'Choose a company and a product' }
  if (!Number.isFinite(price) || price < 0) return { error: 'Enter a price of zero or more' }
  if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) return { error: 'Enter a valid end date' }

  const supabase = await createClient()
  const settings = await getPricingSettings()
  const floor = Math.max(settings.portals.business.minMarginPercent, settings.portals.corporate.minMarginPercent)
  const { data: costRow } = await supabase
    .from('product_costs')
    .select('supplier_cost')
    .eq('product_id', productId)
    .maybeSingle()
  const cost = costRow?.supplier_cost == null ? null : Number(costRow.supplier_cost)
  const blocked = fixedPriceBlockReason(price, cost, floor)
  if (blocked) return { error: blocked }

  const { data: previous } = await supabase
    .from('company_product_prices')
    .select('price, valid_until')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .maybeSingle()
  const { error } = await supabase.from('company_product_prices').upsert({
    company_id: companyId,
    product_id: productId,
    price,
    valid_until: until || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'company_id,product_id' })
  if (error) {
    if (/company_product_prices/i.test(error.message)) {
      return { error: 'Apply supabase/migrations/20261016_company_product_prices.sql, then retry.' }
    }
    return { error: error.message }
  }
  const logError = await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    companyId,
    field: 'company_special',
    oldValue: previous?.price == null ? null : String(previous.price),
    newValue: String(price),
  })
  if (logError) return { error: logError }
  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/pricing')
  revalidatePath('/portal/gifts')
  return { success: true }
}

export async function removeCompanySpecialPrice(formData: FormData) {
  const access = await requirePricing()
  if ('error' in access) return { error: access.error }
  const companyId = String(formData.get('company_id') || '')
  const productId = String(formData.get('product_id') || '')
  if (!isUuid(companyId) || !isUuid(productId)) return { error: 'Special price not found' }
  const supabase = await createClient()
  const { data: previous } = await supabase
    .from('company_product_prices')
    .select('price')
    .eq('company_id', companyId)
    .eq('product_id', productId)
    .maybeSingle()
  const { error } = await supabase
    .from('company_product_prices')
    .delete()
    .eq('company_id', companyId)
    .eq('product_id', productId)
  if (error) return { error: error.message }
  await recordPriceChange(supabase, {
    actorId: access.profile.id,
    productId,
    companyId,
    field: 'company_special',
    oldValue: previous?.price == null ? null : String(previous.price),
    newValue: null,
  })
  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/pricing')
  return { success: true }
}
