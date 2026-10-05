export type PortalDnsMode = 'vercel' | 'hostinger'

/**
 * How company portal hostnames get DNS.
 *
 * Vercel (default on Vercel and in production): `*.ROOT_DOMAIN` is attached to
 * this project. Saving a portal slug does not call Hostinger.
 *
 * Hostinger: local rollback only. Set PORTAL_DNS=hostinger (and usually
 * HOSTINGER_MOCK=1). Ignored when VERCEL=1 or NODE_ENV=production.
 */
export function portalDnsMode(
  env: NodeJS.ProcessEnv = process.env,
): PortalDnsMode {
  if (env.VERCEL === '1' || env.NODE_ENV === 'production') return 'vercel'
  const explicit = (env.PORTAL_DNS || '').trim().toLowerCase()
  if (explicit === 'hostinger' || env.HOSTINGER_MOCK === '1') return 'hostinger'
  return 'vercel'
}
