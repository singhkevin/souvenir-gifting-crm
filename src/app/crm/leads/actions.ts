'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { isUuid } from '@/lib/utils'

const LEAD_STAGES = ['cold', 'warm', 'hot', 'client', 'regular_client'] as const

export async function updateLeadStage(leadId: string, newStage: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to update leads' }
  }
  if (!isUuid(leadId) || !LEAD_STAGES.includes(newStage as (typeof LEAD_STAGES)[number])) {
    return { error: 'Invalid lead update' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({ stage: newStage }).eq('id', leadId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function createLead(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to create leads' }
  }

  const companyId = String(formData.get('company_id') || '')
  if (!isUuid(companyId)) return { error: 'Company is required' }

  const contactId = String(formData.get('contact_id') || '')
  const ownerId = String(formData.get('owner_id') || '') || profile.id
  const source = String(formData.get('source') || '') || null
  const notes = String(formData.get('notes') || '') || null
  const estimatedRaw = String(formData.get('estimated_value') || '')
  const estimated_value = estimatedRaw ? Number(estimatedRaw) : null

  const supabase = await createClient()
  const { data, error } = await supabase.from('leads').insert({
    company_id: companyId,
    contact_id: isUuid(contactId) ? contactId : null,
    owner_id: isUuid(ownerId) ? ownerId : profile.id,
    source,
    stage: 'cold',
    estimated_value: estimated_value != null && Number.isFinite(estimated_value) ? estimated_value : null,
    notes,
  }).select('id').single()
  if (error) return { error: error.message }
  redirect(`/crm/leads/${data.id}`)
}

export async function updateLead(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to update leads' }
  }

  const leadId = String(formData.get('id') || '')
  if (!isUuid(leadId)) return { error: 'Lead is required' }

  const contactId = String(formData.get('contact_id') || '')
  const source = String(formData.get('source') || '')
  const notes = String(formData.get('notes') || '') || null
  const estimatedRaw = String(formData.get('estimated_value') || '')
  const estimated_value = estimatedRaw ? Number(estimatedRaw) : 0
  const followUp = String(formData.get('next_follow_up_at') || '') || null

  const supabase = await createClient()
  const { error } = await supabase.from('leads').update({
    contact_id: isUuid(contactId) ? contactId : null,
    source: source || 'other',
    notes,
    estimated_value: Number.isFinite(estimated_value) ? estimated_value : 0,
    next_follow_up_at: followUp,
  }).eq('id', leadId)
  if (error) return { error: error.message }
  redirect(`/crm/leads/${leadId}`)
}

export async function removeLead(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales'].includes(profile.role)) {
    return { error: 'Not permitted to remove leads' }
  }

  const leadId = String(formData.get('id') || '')
  if (!isUuid(leadId)) return { error: 'Lead is required' }

  const supabase = await createClient()
  const { count: requirementCount } = await supabase
    .from('requirements')
    .select('id', { count: 'exact', head: true })
    .eq('lead_id', leadId)
  if (requirementCount) {
    return { error: 'This lead cannot be deleted because it has linked requirements.' }
  }

  const { error } = await supabase.from('leads').delete().eq('id', leadId)
  if (error) return { error: error.message }
  redirect('/crm/leads')
}
