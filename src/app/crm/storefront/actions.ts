'use server'

import { revalidatePath } from 'next/cache'
import { invalidatePublicCatalogue } from '@/lib/catalogue/public-read'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isStaffRole } from '@/lib/roles'
import { isUuid } from '@/lib/utils'
import { STORE_OCCASIONS, occasionTagList } from '@/lib/catalogue/storefront'

const DENIED = 'You do not have access to the storefront.'

async function requireStoreStaff() {
  const profile = await getProfile()
  if (!profile || !profile.is_active || !isStaffRole(profile.role)) return null
  if (!['admin', 'sales', 'management'].includes(profile.role)) return null
  return profile
}

function logoProblem(value: string) {
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes(' ')) return null
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return null
  } catch {
    // fall through
  }
  return 'Use a site path or an http(s) logo URL.'
}

export async function saveBrandLogo(formData: FormData) {
  const profile = await requireStoreStaff()
  if (!profile) return { error: DENIED }
  const id = String(formData.get('brand_id') || '')
  if (!isUuid(id)) return { error: 'Choose a brand.' }
  const logo = String(formData.get('logo_url') || '').trim()
  const problem = logoProblem(logo)
  if (problem) return { error: problem }
  const supabase = await createClient()
  const { error } = await supabase.from('brands').update({ logo_url: logo || null }).eq('id', id)
  if (error) {
    if (/logo_url|schema cache/i.test(error.message)) {
      return { error: 'Apply the storefront migration before saving a logo.' }
    }
    return { error: error.message }
  }
  invalidatePublicCatalogue()
  revalidatePath('/crm/storefront')
  revalidatePath('/home')
  return { ok: true }
}

export async function saveProductOccasions(formData: FormData) {
  const profile = await requireStoreStaff()
  if (!profile) return { error: DENIED }
  const id = String(formData.get('product_id') || '')
  if (!isUuid(id)) return { error: 'Choose a product.' }
  const tags = occasionTagList(STORE_OCCASIONS.map((item) => item.id).filter((tag) => formData.get(`tag_${tag}`) === 'on'))
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ occasion_tags: tags }).eq('id', id)
  if (error) {
    if (/occasion_tags|schema cache/i.test(error.message)) {
      return { error: 'Apply the storefront migration before saving occasions.' }
    }
    return { error: error.message }
  }
  invalidatePublicCatalogue()
  revalidatePath('/crm/storefront')
  revalidatePath('/catalogue')
  return { ok: true }
}
