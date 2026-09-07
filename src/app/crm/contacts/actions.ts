'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'

const CONTACT_ROLES = ['admin', 'sales', 'management'] as const

async function requireContactEditor() {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (!CONTACT_ROLES.includes(profile.role as (typeof CONTACT_ROLES)[number])) {
    return { error: 'Not permitted to manage contacts' as const }
  }
  return { profile }
}

export async function createContact(formData: FormData) {
  const access = await requireContactEditor()
  if ('error' in access) return { error: access.error }

  const supabase = await createClient()
  const fullName = String(formData.get('full_name') || '').trim()
  const companyId = String(formData.get('company_id') || '')
  if (!fullName || !companyId) return { error: 'Name and company are required' }

  const { error } = await supabase.from('contacts').insert({
    full_name: fullName,
    company_id: companyId,
    designation: String(formData.get('designation') || '') || null,
    email: String(formData.get('email') || '') || null,
    phone: String(formData.get('phone') || '') || null,
    contact_type: String(formData.get('contact_type') || 'primary'),
    kind: 'corporate',
    notes: String(formData.get('notes') || '') || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/crm/contacts')
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function updateContact(formData: FormData) {
  const access = await requireContactEditor()
  if ('error' in access) return { error: access.error }

  const id = String(formData.get('id') || '')
  const fullName = String(formData.get('full_name') || '').trim()
  const companyId = String(formData.get('company_id') || '')
  if (!id || !fullName || !companyId) return { error: 'Name and company are required' }

  const supabase = await createClient()
  const { error } = await supabase.from('contacts').update({
    full_name: fullName,
    company_id: companyId,
    designation: String(formData.get('designation') || '') || null,
    email: String(formData.get('email') || '') || null,
    phone: String(formData.get('phone') || '') || null,
    contact_type: String(formData.get('contact_type') || 'primary'),
    notes: String(formData.get('notes') || '') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/contacts')
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function removeContact(formData: FormData) {
  const access = await requireContactEditor()
  if ('error' in access) return { error: access.error }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Contact is required' }

  const supabase = await createClient()
  const { data: contact } = await supabase.from('contacts').select('id, company_id, full_name').eq('id', id).maybeSingle()
  if (!contact) return { error: 'Contact not found' }

  const [{ count: leads }, { count: orders }, { count: quotations }, { count: requirements }, { count: reviews }] = await Promise.all([
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('contact_id', id),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('contact_id', id),
  ])
  if (leads || orders || quotations || requirements || reviews) {
    redirect('/crm/contacts?error=' + encodeURIComponent('This contact cannot be deleted because it is linked to leads, orders, quotations, or reviews.'))
  }

  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/contacts')
  if (contact.company_id) revalidatePath(`/crm/companies/${contact.company_id}`)
  return { success: true }
}
