import { headers } from 'next/headers'
import { redirectToMicrosite } from '@/lib/account-home'
import { getProfile } from '@/lib/auth'
import { sessionHintFromHeaders } from '@/lib/auth/session-cookie'
import { isClientRole, isGiftEmployeeRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

/** Company microsite accounts never use /business, including the public catalogue. */
export default async function BusinessProductLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers()
  if (!sessionHintFromHeaders((name) => headerStore.get(name))) return children
  const profile = await getProfile()
  if (profile && (isClientRole(profile.role) || isGiftEmployeeRole(profile.role))) {
    await redirectToMicrosite(profile.company_id, profile.role)
  }
  return children
}
