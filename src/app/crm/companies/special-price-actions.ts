'use server'

import { revalidatePath } from 'next/cache'
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
  revalidatePath(`/crm/companies/${companyId}`)
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
  const { error } = await supabase
    .from('company_product_prices')
    .delete()
    .eq('company_id', companyId)
    .eq('product_id', productId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}
