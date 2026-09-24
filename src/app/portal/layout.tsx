import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalLayout } from '@/components/layout/portal-layout'
import { getRequestTabId } from '@/lib/auth/tab-server'
import { TabSessionRevive } from '@/components/auth/tab-session-revive'

export const dynamic = 'force-dynamic'

export default async function PortalLayoutWrapper({ children }: { children: React.ReactNode }) {
  if (!(await getRequestTabId())) return <TabSessionRevive />

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, company_id, is_active')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    redirect('/login')
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (profile.role !== 'client_admin' && profile.role !== 'client_user') {
    redirect('/crm/dashboard')
  }

  // Get company name
  let companyName = 'Your Company'
  if (profile.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', profile.company_id)
      .maybeSingle()
    if (company) companyName = company.name
  }

  const displayName = profile.full_name || user.email?.split('@')[0] || 'User'

  return (
    <PortalLayout user={{ name: displayName, company_name: companyName }}>
      {children}
    </PortalLayout>
  )
}
