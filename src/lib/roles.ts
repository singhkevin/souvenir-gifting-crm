export const STAFF_ROLES = ['admin', 'sales', 'operations', 'accounts', 'management'] as const
export const CLIENT_ROLES = ['client_admin', 'client_user'] as const
export const BUSINESS_ROLES = ['business_user'] as const

export type StaffRole = (typeof STAFF_ROLES)[number]
export type ClientRole = (typeof CLIENT_ROLES)[number]
export type BusinessRole = (typeof BUSINESS_ROLES)[number]

function includes(list: readonly string[], role: string | null | undefined) {
  return Boolean(role && list.includes(role))
}

export function isStaffRole(role: string | null | undefined): boolean {
  return includes(STAFF_ROLES, role)
}

export function isClientRole(role: string | null | undefined): boolean {
  return includes(CLIENT_ROLES, role)
}

export function isBusinessRole(role: string | null | undefined): boolean {
  return includes(BUSINESS_ROLES, role)
}
