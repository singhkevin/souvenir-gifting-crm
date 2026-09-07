'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'

export async function createAnnouncement(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to post announcements' }
  }

  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  if (!title || !body) return { error: 'Title and message are required' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, body, created_by: profile.id })
    .select('id')
    .single()
  if (error) return { error: error.message }

  await writeAudit(supabase, {
    action: 'create',
    entity: 'announcements',
    entityId: data.id,
    next: { title },
    userId: profile.id,
  })

  revalidatePath('/crm/announcements')
  return { success: true }
}

export async function updateAnnouncement(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to edit announcements' }
  }

  const id = String(formData.get('id') || '')
  const title = String(formData.get('title') || '').trim()
  const body = String(formData.get('body') || '').trim()
  if (!id || !title || !body) return { error: 'Title and message are required' }

  const supabase = await createClient()
  const { error } = await supabase.from('announcements').update({ title, body }).eq('id', id)
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'update',
    entity: 'announcements',
    entityId: id,
    next: { title },
    userId: profile.id,
  })
  revalidatePath('/crm/announcements')
  return { success: true }
}

export async function removeAnnouncement(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to remove announcements' }
  }

  const id = String(formData.get('id') || '')
  if (!id) return { error: 'Announcement is required' }

  const supabase = await createClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'delete',
    entity: 'announcements',
    entityId: id,
    userId: profile.id,
  })
  revalidatePath('/crm/announcements')
  return { success: true }
}
