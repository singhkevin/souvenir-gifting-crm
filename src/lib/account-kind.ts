const STAFF_ROLES = new Set(['admin', 'sales', 'operations', 'accounts', 'management'])
const CLIENT_ROLES = new Set(['client_admin', 'client_user'])

export type AccountKind = 'staff' | 'client' | 'retail'

/** Staff, company portal clients, or everyone else (retail and business). */
export function accountKindForRole(role: string | null | undefined): AccountKind {
  if (!role) return 'retail'
  if (CLIENT_ROLES.has(role)) return 'client'
  if (STAFF_ROLES.has(role)) return 'staff'
  return 'retail'
}
