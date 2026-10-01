import { NextRequest, NextResponse } from 'next/server'
import { resolveHost } from '@/lib/portal-host'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const hostname = (hostHeader || '').split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
  const resolved = resolveHost(hostHeader)

  const body =
    resolved.kind === 'tenant'
      ? { app: 'souvenir-crm', host: hostname, kind: 'tenant' as const, slug: resolved.slug }
      : { app: 'souvenir-crm', host: hostname, kind: 'main' as const }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
