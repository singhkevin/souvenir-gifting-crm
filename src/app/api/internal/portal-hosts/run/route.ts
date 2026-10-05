// Optional maintenance hook. On Vercel this reconciles portal_hosts rows only;
// it does not call the Hostinger parked-domain API. Company hostnames resolve
// from ROOT_DOMAIN + the *.ROOT_DOMAIN wildcard without this route.
import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { resolveHost } from '@/lib/portal-host'
import { runPortalHostsWorker } from '@/lib/portal-hosts/worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest()
}

function authorized(request: NextRequest) {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  try {
    return timingSafeEqual(sha256(match[1].trim()), sha256(secret))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const resolved = resolveHost(host)
  if (resolved.kind === 'tenant') {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const result = await runPortalHostsWorker()
  return NextResponse.json(result, {
    status: result.fatal ? 500 : 200,
    headers: { 'Cache-Control': 'no-store' },
  })
}
