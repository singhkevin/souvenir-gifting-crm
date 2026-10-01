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
  if (role === 'client_admin' || role === 'client_user') return '/portal/catalogue'
  return '/crm/dashboard'
}
