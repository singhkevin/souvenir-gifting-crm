import 'server-only'

import { redirect } from 'next/navigation'
import { redirectToMicrosite } from '@/lib/account-home'
import type { ProfileSession } from '@/lib/auth'
import { getBusinessAccess } from '@/lib/business/access'
import type { BusinessAccessCompany } from '@/lib/business/access-state'
import { businessLoginPath } from '@/lib/business/portal-paths'
import { isClientRole, isGiftEmployeeRole, isStaffRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type BusinessCompany = BusinessAccessCompany

/** Signed-in business account, or null for guests, other roles, and rejected accounts. */
export async function readBusinessSession(): Promise<{ profile: ProfileSession; company: BusinessCompany | null } | null> {
  const access = await getBusinessAccess()
  if (!access.profile) return null
  if (access.state !== 'pending' && access.state !== 'verified') return null
  return { profile: access.profile as ProfileSession, company: access.company }
}

export async function requireBusiness(): Promise<{ profile: ProfileSession; company: BusinessCompany | null }> {
  const access = await getBusinessAccess()
  const profile = access.profile
  if (!profile || access.state === 'signed_out') redirect(businessLoginPath('/business/dashboard'))
  if (!profile.is_active || access.state === 'blocked') {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect(businessLoginPath('/business/dashboard', 'blocked'))
  }
  if (access.state === 'wrong_account') {
    if (isClientRole(profile.role) || isGiftEmployeeRole(profile.role)) {
      await redirectToMicrosite(profile.company_id, profile.role)
    }
    if (isStaffRole(profile.role)) redirect('/crm/dashboard')
    if (profile.role === 'runner') redirect('/crm/runs')
    redirect(businessLoginPath('/business/dashboard', 'wrong-account'))
  }
  if (access.state === 'rejected' || access.state === 'email_not_allowed') {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect(businessLoginPath('/business/login', access.state === 'rejected' ? 'rejected' : 'email'))
  }
  return { profile: profile as ProfileSession, company: access.company }
}
