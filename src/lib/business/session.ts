import 'server-only'

import { redirect } from 'next/navigation'
import { redirectToMicrosite } from '@/lib/account-home'
import { getProfile, type ProfileSession } from '@/lib/auth'
import { isBusinessRole, isClientRole, isGiftEmployeeRole, isStaffRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

export type BusinessCompany = {
  id: string
  name: string
  account_type: string | null
  business_verification: string | null
  gst_number: string | null
  city: string | null
  state: string | null
  country: string | null
  website: string | null
  notes: string | null
}

/** Signed-in business account, or null for guests, staff, and rejected accounts. */
export async function readBusinessSession(): Promise<{ profile: ProfileSession; company: BusinessCompany | null } | null> {
  const profile = await getProfile()
  if (!profile?.is_active || !isBusinessRole(profile.role)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, account_type, business_verification, gst_number, city, state, country, website, notes')
    .eq('id', profile.company_id || '')
    .maybeSingle()

  const company = error ? null : (data as BusinessCompany | null)
  if (company?.business_verification === 'rejected') return null
  return { profile, company }
}

export async function requireBusiness(): Promise<{ profile: ProfileSession; company: BusinessCompany | null }> {
  const profile = await getProfile()
  if (!profile) redirect('/login?next=/business/dashboard')
  if (!profile.is_active) {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }
  if (!isBusinessRole(profile.role)) {
    if (isClientRole(profile.role) || isGiftEmployeeRole(profile.role)) {
      await redirectToMicrosite(profile.company_id, profile.role)
    }
    if (isStaffRole(profile.role)) redirect('/crm/dashboard')
    if (profile.role === 'runner') redirect('/crm/runs')
    redirect('/login')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, account_type, business_verification, gst_number, city, state, country, website, notes')
    .eq('id', profile.company_id || '')
    .maybeSingle()

  const company = error ? null : (data as BusinessCompany | null)
  if (company?.business_verification === 'rejected') {
    await supabase.auth.signOut()
    redirect('/login?error=business')
  }
  return { profile, company }
}
