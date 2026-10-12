import { NextRequest, NextResponse } from 'next/server'
import { resolveHost } from '@/lib/portal-host'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const hostname = (hostHeader || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  const resolved = resolveHost(hostHeader)

  const body = {
    app: 'souvenir-crm',
    host: hostname,
    kind: resolved.kind,
    ...(resolved.kind === 'tenant' ? { slug: resolved.slug } : {}),
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
