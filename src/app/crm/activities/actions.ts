'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function logActivity(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const title = String(formData.get('title') || '').trim()
  if (!title) return { error: 'Title is required' }

  const relatedType = String(formData.get('related_type') || '') || null
  const relatedId = String(formData.get('related_id') || '') || null

  const { error } = await supabase.from('activities').insert({
    title,
    type: String(formData.get('type') || 'follow_up'),
    due_at: String(formData.get('due_at') || '') || null,
    assigned_to: String(formData.get('assigned_to') || '') || user.id,
    related_type: relatedType,
    related_id: relatedId,
    status: 'open',
    notes: String(formData.get('notes') || '') || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/crm/activities')
  revalidatePath('/crm/my-work')
  if (relatedType === 'requirement' && relatedId) revalidatePath(`/crm/requirements/${relatedId}`)
  return { success: true }
}

export async function updateActivity(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  if (!id || !title) return { error: 'Title is required' }

  const { error } = await supabase.from('activities').update({
    title,
    type: String(formData.get('type') || 'follow_up'),
    notes: String(formData.get('notes') || '') || null,
    status: String(formData.get('status') || 'upcoming'),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/activities')
  return { success: true }
}

export async function removeActivity(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Activity is required' }
  const { error } = await supabase.from('activities').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/activities')
  return { success: true }
}
