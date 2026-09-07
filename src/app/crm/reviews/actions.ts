'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'

async function requireReviewEditor() {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (profile.role !== 'admin' && profile.role !== 'management') return { error: 'Not authorised' as const }
  return { profile }
}

export async function createReview(formData: FormData) {
  const access = await requireReviewEditor()
  if ('error' in access) return { error: access.error }

  const supabase = await createClient()
  const companyId = String(formData.get('company_id') || '')
  const rating = Number(formData.get('rating') || 0)
  if (!companyId || rating < 1 || rating > 5) return { error: 'Company and rating are required' }

  const { error } = await supabase.from('reviews').insert({
    company_id: companyId,
    order_id: String(formData.get('order_id') || '') || null,
    rating,
    feedback: String(formData.get('feedback') || '') || null,
    status: 'published',
  })
  if (error) return { error: error.message }
  revalidatePath('/crm/reviews')
  return { success: true }
}

export async function updateReview(formData: FormData) {
  const access = await requireReviewEditor()
  if ('error' in access) return { error: access.error }

  const id = String(formData.get('id') || '')
  const rating = Number(formData.get('rating') || 0)
  if (!id || rating < 1 || rating > 5) return { error: 'Rating is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('reviews').update({
    rating,
    feedback: String(formData.get('feedback') || '') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/reviews')
  return { success: true }
}

export async function removeReview(formData: FormData) {
  const access = await requireReviewEditor()
  if ('error' in access) return { error: access.error }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Review is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/crm/reviews')
  return { success: true }
}
