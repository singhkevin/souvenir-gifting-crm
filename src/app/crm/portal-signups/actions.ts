'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import {
  decidePortalSignups,
  pendingPortalUserIds,
} from '@/lib/portal/signup-server'
import { isClientRole } from '@/lib/roles'

async function actor() {
  const profile = await getProfile()
  if (!profile || profile.is_active === false) return { error: 'Not authenticated' as const }
  const allowed = profile.role === 'admin' || profile.role === 'sales' || profile.role === 'client_admin'
  if (!allowed) return { error: 'You cannot approve portal accounts.' as const }
  const approval = await actorApproval(profile.id)
  return { profile, approval }
}

async function actorApproval(userId: string) {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data, error } = await supabase.from('profiles').select('portal_approval').eq('id', userId).maybeSingle()
  if (error) return null
  return data?.portal_approval ?? null
}

export async function decidePortalSignupAction(formData: FormData) {
  const decision = String(formData.get('decision') || '')
  if (decision !== 'approved' && decision !== 'rejected') return { error: 'Choose approve or reject.' }
  const access = await actor()
  if ('error' in access && !('profile' in access)) return { error: access.error }
  const { profile, approval } = access as Exclude<typeof access, { error: string }>

  let ids = formData.getAll('user_id').map((value) => String(value)).filter(Boolean)
  if (String(formData.get('all') || '') === '1') {
    const companyId = isClientRole(profile.role) ? profile.company_id : String(formData.get('company_id') || '') || null
    ids = await pendingPortalUserIds(companyId)
  }
  if (isClientRole(profile.role)) {
    // Company admins only decide their own company. The decision helper checks the company again.
  }

  const result = await decidePortalSignups({
    actorId: profile.id,
    actorRole: profile.role,
    actorCompanyId: profile.company_id,
    actorApproval: approval,
    decision,
    userIds: ids,
  })
  revalidatePath('/crm/portal-signups')
  revalidatePath('/portal/people')
  revalidatePath('/crm/companies')
  return result
}
