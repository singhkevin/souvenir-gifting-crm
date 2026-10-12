import { NextRequest, NextResponse } from 'next/server'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { portalFindResult } from '@/lib/domain-routing'
import { PORTAL_FIND_MESSAGE } from '@/lib/portal-find-message'
import { checkPortalFindRate, parsePortalFindInput } from '@/lib/portal-find'
import { effectivePortalRoot, resolveTenantBySlug } from '@/lib/portal-host'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

function clientKey(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || ''
  return forwarded.split(',')[0]?.trim() || 'unknown'
}

export async function POST(request: NextRequest) {
  if (!domainSplitEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })
  }

  const limit = checkPortalFindRate(clientKey(request))
  if (!limit.ok) {
    return NextResponse.json(
      { ok: true, message: PORTAL_FIND_MESSAGE, redirectTo: null },
      { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfter) } },
    )
  }

  let raw = ''
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null) as { query?: unknown } | null
    raw = typeof body?.query === 'string' ? body.query : ''
  } else {
    const form = await request.formData().catch(() => null)
    raw = String(form?.get('query') || '')
  }

  const parsed = parsePortalFindInput(raw, effectivePortalRoot())
  if (parsed.kind !== 'slug') {
    return NextResponse.json(portalFindResult(null), { headers: NO_STORE })
  }

  const tenant = await resolveTenantBySlug(parsed.slug)
  return NextResponse.json(portalFindResult(tenant ? parsed.slug : null), { headers: NO_STORE })
}
