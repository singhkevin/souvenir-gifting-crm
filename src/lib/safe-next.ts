import { accountKindForRole } from '@/lib/account-kind'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { isBusinessRole, isClientRole } from '@/lib/roles'

/**
 * Only allow in-app relative paths as post-login destinations.
 * Rejects protocol-relative URLs, other hosts, and the login page itself.
 */
export function isSafeNext(value: string | null | undefined): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.startsWith('/login')) return false
  if (value.includes('\\')) return false
  return true
}

export function landingPathForRole(role: string | null | undefined): string {
  if (isClientRole(role)) return '/portal/catalogue'
  if (isBusinessRole(role)) return '/business/dashboard'
  if (domainSplitEnabled() && accountKindForRole(role) !== 'staff') return '/'
  return '/crm/dashboard'
}
