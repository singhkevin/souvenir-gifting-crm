import { isClientRole, isGiftEmployeeRole, isStaffRole } from '@/lib/roles'

export type AccountKind = 'staff' | 'client' | 'retail'

/** Staff, company portal clients, or everyone else (retail and business_user). */
export function accountKindForRole(role: string | null | undefined): AccountKind {
  if (!role) return 'retail'
  if (isClientRole(role) || isGiftEmployeeRole(role)) return 'client'
  if (isStaffRole(role)) return 'staff'
  return 'retail'
}
