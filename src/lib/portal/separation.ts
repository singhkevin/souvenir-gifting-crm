import { isBusinessRole, isClientRole, isGiftEmployeeRole, isRunnerRole, isStaffRole } from '@/lib/roles'
import { isSafeNext } from '@/lib/safe-next'

export function canSendPortalInvite(role: string | null | undefined) {
  return role === 'admin' || role === 'sales'
}

/**
 * Post-confirm destinations stay inside the account's product.
 * A company portal login cannot land on /business, and a business login cannot land on /portal.
 */
export function confirmNextAllowed(role: string | null | undefined, next: string | null | undefined): next is string {
  if (!isSafeNext(next)) return false
  if (isGiftEmployeeRole(role)) return next === '/gift' || next.startsWith('/gift/')
  if (isClientRole(role)) return next === '/portal' || next.startsWith('/portal/')
  if (isBusinessRole(role)) return next === '/business' || next.startsWith('/business/')
  if (isStaffRole(role) || isRunnerRole(role)) {
    return next === '/crm' || next.startsWith('/crm/') || next === '/dashboard' || next.startsWith('/dashboard/')
  }
  return !next.startsWith('/portal') && !next.startsWith('/business') && !next.startsWith('/crm') && !next.startsWith('/gift')
}
