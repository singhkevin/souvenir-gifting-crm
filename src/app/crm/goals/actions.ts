'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const title = String(formData.get('title') || '').trim()
  const target = Number(formData.get('target') || 0)
  if (!title || !target) return { error: 'Title and target are required' }

  const { error } = await supabase.from('goals').insert({
    title,
    period_type: String(formData.get('period_type') || 'month'),
    period_start: String(formData.get('period_start') || '') || new Date().toISOString().slice(0, 10),
    metric: String(formData.get('metric') || 'revenue'),
    target,
    owner_id: String(formData.get('owner_id') || '') || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }
  revalidatePath('/crm/goals')
  return { success: true }
}

export async function updateGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  const target = Number(formData.get('target') || 0)
  if (!id || !title || !target) return { error: 'Title and target are required' }

  const { error } = await supabase.from('goals').update({
    title,
    period_type: String(formData.get('period_type') || 'month'),
    period_start: String(formData.get('period_start') || '') || new Date().toISOString().slice(0, 10),
    metric: String(formData.get('metric') || 'revenue'),
    target,
    owner_id: String(formData.get('owner_id') || '') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/goals')
  return { success: true }
}

export async function removeGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Goal is required' }
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/goals')
  return { success: true }
}
