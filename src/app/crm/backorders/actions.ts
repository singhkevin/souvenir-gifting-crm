'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createQuotationFromRequirement } from '@/app/crm/requirements/actions'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'

const ROLES = ['admin', 'sales', 'operations', 'management'] as const

async function staffClient() {
  const profile = await getProfile()
  if (!profile?.is_active || !ROLES.includes(profile.role as (typeof ROLES)[number])) {
    return { error: 'Not authorised' as const, supabase: null, profile: null }
  }
  return { error: null, supabase: await createClient(), profile }
}

function revalidate(id: string) {
  revalidatePath('/crm/backorders')
  revalidatePath(`/crm/backorders/${id}`)
}

export async function acceptBackorder(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Request not found' }
  const access = await staffClient()
  if (access.error || !access.supabase || !access.profile) return { error: access.error || 'Not authorised' }

  const { data, error } = await access.supabase
    .from('store_backorder_requests')
    .update({
      status: 'accepted',
      decided_at: new Date().toISOString(),
      decided_by: access.profile.id,
    })
    .eq('id', id)
    .eq('status', 'open')
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Only an open request can be accepted' }
  revalidate(id)
  return { success: true }
}

export async function declineBackorder(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Request not found' }
  const access = await staffClient()
  if (access.error || !access.supabase || !access.profile) return { error: access.error || 'Not authorised' }

  const { data, error } = await access.supabase
    .from('store_backorder_requests')
    .update({
      status: 'declined',
      decided_at: new Date().toISOString(),
      decided_by: access.profile.id,
    })
    .eq('id', id)
    .in('status', ['open', 'accepted'])
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'This request can no longer be declined' }
  revalidate(id)
  return { success: true }
}

export async function convertBackorder(formData: FormData) {
  const id = String(formData.get('id') || '')
  if (!isUuid(id)) return { error: 'Request not found' }
  const access = await staffClient()
  if (access.error || !access.supabase || !access.profile) return { error: access.error || 'Not authorised' }

  const { data: row, error: readError } = await access.supabase
    .from('store_backorder_requests')
    .select('id, status, requirement_id')
    .eq('id', id)
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!row) return { error: 'Request not found' }
  if (row.status === 'declined' || row.status === 'converted') {
    return { error: 'This request can no longer be converted' }
  }
  if (!row.requirement_id) return { error: 'This request has no requirement to quote' }

  const { error: statusError } = await access.supabase
    .from('store_backorder_requests')
    .update({
      status: 'converted',
      decided_at: new Date().toISOString(),
      decided_by: access.profile.id,
    })
    .eq('id', id)
  if (statusError) return { error: statusError.message }

  const quoteForm = new FormData()
  quoteForm.set('requirement_id', String(row.requirement_id))
  const key = String(formData.get('idempotency_key') || '')
  if (key) quoteForm.set('idempotency_key', key)
  const result = await createQuotationFromRequirement(quoteForm)
  if (result && typeof result === 'object' && 'error' in result && result.error) {
    await access.supabase.from('store_backorder_requests').update({ status: row.status }).eq('id', id)
    return { error: String(result.error) }
  }
  revalidate(id)
  revalidatePath(`/crm/requirements/${row.requirement_id}`)
  return result
}
