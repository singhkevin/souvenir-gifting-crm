import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSafeNext, landingPathForRole } from '@/lib/safe-next'
import { authCookieOptions, localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { TAB_HEADER, TAB_QUERY, TAB_URL_HEADER, authCookieName, isPublicAuthPath, isPublicSitePath, isTabId } from '@/lib/auth/tab'
import { SESSION_HEADER, hasAuthSessionCookie, publicReadSkipsSession } from '@/lib/auth/session-cookie'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { businessPortalRedirect, decideHostRoute, pendingPortalRedirect, robotsHeaderFor, staffAreaRedirect } from '@/lib/domain-routing'
import {
  applyTenantHeaders,
  isInternalApiPath,
  isPortalFindPath,
  isPortalPingPath,
  isTenantAuthPath,
  isTenantGatePath,
  isTrialExpired,
  portalUrlForSlug,
  resolveHost,
  resolvePortalRedirect,
  resolveTenantBySlug,
  type ResolvedHost,
  type ResolvedTenant,
} from '@/lib/portal-host'

function requestUrlHint(request: NextRequest) {
  return `${request.nextUrl.pathname}${request.nextUrl.search}`
}

function withRequestHeaders(request: NextRequest, mutate: (headers: Headers) => void, tabId?: string | null) {
  const requestHeaders = new Headers(request.headers)
  mutate(requestHeaders)
  requestHeaders.set(TAB_URL_HEADER, requestUrlHint(request))
  if (isTabId(tabId)) requestHeaders.set(TAB_HEADER, tabId)
  requestHeaders.delete(SESSION_HEADER)
  if (hasAuthSessionCookie(request.cookies.getAll())) requestHeaders.set(SESSION_HEADER, '1')
  return NextResponse.next({ request: { headers: requestHeaders } })
}

function withTabRequest(request: NextRequest, tabId?: string | null, tenant?: ResolvedTenant | null) {
  return withRequestHeaders(
    request,
    (headers) => {
      applyTenantHeaders(headers, tenant ?? null)
    },
    tabId,
  )
}

function withTabQuery(url: URL, tabId: string) {
  url.searchParams.set(TAB_QUERY, tabId)
  return url
}

function withHostRobots(response: NextResponse, host: ResolvedHost, pathname: string) {
  if (response.status >= 300 && response.status < 400) return response
  const tag = robotsHeaderFor(host, pathname)
  if (tag) response.headers.set('X-Robots-Tag', tag)
  return response
}

function tenantCanSkipLogin(pathname: string) {
  if (pathname === '/gift/join' || pathname.startsWith('/gift/join/')) return true
  if (isTenantAuthPath(pathname) || isTenantGatePath(pathname)) return true
  return domainSplitEnabled() && (pathname === '/auth' || pathname.startsWith('/auth/'))
}

function rewriteToTenantPage(
  request: NextRequest,
  path: '/tenant/not-found' | '/tenant/suspended' | '/tenant/trial-expired',
  status: number,
  tabId: string | null,
  tenant: ResolvedTenant | null,
) {
  const url = request.nextUrl.clone()
  url.pathname = path
  const response = NextResponse.rewrite(url, {
    status,
    request: {
      headers: (() => {
        const headers = new Headers(request.headers)
        applyTenantHeaders(headers, tenant)
        headers.set(TAB_URL_HEADER, requestUrlHint(request))
        if (isTabId(tabId)) headers.set(TAB_HEADER, tabId)
        headers.delete(SESSION_HEADER)
        if (hasAuthSessionCookie(request.cookies.getAll())) headers.set(SESSION_HEADER, '1')
        return headers
      })(),
    },
  })
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const queryTab = request.nextUrl.searchParams.get(TAB_QUERY)
  const headerTab = request.headers.get(TAB_HEADER)
  const tabId = isTabId(headerTab) ? headerTab : isTabId(queryTab) ? queryTab : null

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next({ request })
  }

  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const resolved = resolveHost(host)
  const respond = (response: NextResponse) => withHostRobots(response, resolved, pathname)

  // Finder lookup is public on the portal apex only. Off, or on any other host, it is 404.
  if (isPortalFindPath(pathname)) {
    if (!domainSplitEnabled() || (resolved.kind !== 'portal-root' && resolved.kind !== 'dev')) {
      return respond(NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }))
    }
    return respond(withTabRequest(request, tabId, null))
  }

  // Health ping, robots, and sitemap: no auth and no tenant gate.
  // Tenant hosts would otherwise rewrite these to the portal not-found page.
  if (
    isPortalPingPath(pathname) ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return respond(withTabRequest(request, tabId, null))
  }

  if (domainSplitEnabled()) {
    const decision = decideHostRoute(resolved, pathname, search)
    if (decision.action === 'redirect') {
      return respond(NextResponse.redirect(decision.location, decision.status))
    }
    if (decision.action === 'not-found') {
      return respond(NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }))
    }
  }

  // Internal worker routes: apex only; tenant hosts get 404. With the split on, admin and dev only.
  if (isInternalApiPath(pathname)) {
    const quoteCronOnStore = domainSplitEnabled() && resolved.kind === 'store' && pathname === '/api/internal/quotes/expire'
    if (!quoteCronOnStore && (resolved.kind === 'tenant' || (domainSplitEnabled() && resolved.kind !== 'admin' && resolved.kind !== 'dev' && resolved.kind !== 'main'))) {
      return respond(NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } }))
    }
    return respond(withTabRequest(request, tabId, null))
  }

  const tenant = resolved.kind === 'tenant' ? await resolveTenantBySlug(resolved.slug) : null

  if (resolved.kind === 'tenant') {
    if (!tenant) {
      const redirect = await resolvePortalRedirect(resolved.slug)
      if (redirect?.kind === 'live') {
        const targetBase = portalUrlForSlug(redirect.targetSlug)
        if (targetBase) {
          const dest = new URL(targetBase)
          dest.pathname = pathname
          dest.search = search
          return respond(NextResponse.redirect(dest, 307))
        }
      }
      if (redirect?.kind === 'pending') {
        const pending = pendingPortalRedirect(host)
        return respond(NextResponse.redirect(pending.location, pending.status))
      }
      if (isTenantGatePath(pathname) && pathname.startsWith('/tenant/not-found')) {
        return respond(withTabRequest(request, tabId, null))
      }
      return respond(rewriteToTenantPage(request, '/tenant/not-found', 404, tabId, null))
    }

    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      if (isTenantGatePath(pathname) && pathname.startsWith('/tenant/suspended')) {
        return respond(withTabRequest(request, tabId, tenant))
      }
      return respond(rewriteToTenantPage(request, '/tenant/suspended', 403, tabId, tenant))
    }

    if (
      pathname.startsWith('/crm') ||
      pathname === '/dashboard' ||
      pathname.startsWith('/dashboard/') ||
      pathname === '/share' ||
      pathname.startsWith('/share/')
    ) {
      const staff = staffAreaRedirect(host, pathname, search)
      return respond(NextResponse.redirect(staff.location, staff.status))
    }
    if (pathname === '/business' || pathname.startsWith('/business/')) {
      const business = businessPortalRedirect(host, pathname, search)
      return respond(NextResponse.redirect(business.location, business.status))
    }
  }

  if (!isTabId(tabId)) {
    if (resolved.kind === 'tenant' && !tenantCanSkipLogin(pathname)) {
      return respond(NextResponse.redirect(new URL('/login', request.url)))
    }
    return respond(withTabRequest(request, null, tenant))
  }

  if (publicReadSkipsSession(resolved.kind, pathname)) {
    return respond(withTabRequest(request, tabId, tenant))
  }

  let supabaseResponse = withTabRequest(request, tabId, tenant)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(authCookieName(tabId), host),
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = withTabRequest(request, tabId, tenant)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, localCookieWriteOptions(options, host))
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (resolved.kind === 'tenant' && tenant) {
    const copyCookies = (redirect: NextResponse) => {
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return respond(redirect)
    }
    if (isTenantGatePath(pathname)) {
      return respond(supabaseResponse)
    }
    if (!user) {
      if (pathname === '/gift' || (pathname.startsWith('/gift/') && !pathname.startsWith('/gift/join'))) {
        return respond(copyCookies(NextResponse.redirect(withTabQuery(new URL('/gift/join', request.url), tabId))))
      }
      if (!tenantCanSkipLogin(pathname)) {
        const login = withTabQuery(new URL('/login', request.url), tabId)
        const intended = `${pathname}${search}`
        if (isSafeNext(intended)) login.searchParams.set('next', intended)
        return respond(copyCookies(NextResponse.redirect(login)))
      }
      return respond(supabaseResponse)
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, is_active')
      .eq('id', user.id)
      .maybeSingle()
    const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
    const isGiftEmployee = profile?.role === 'gift_employee'
    const matches = Boolean(
      (isClient || isGiftEmployee) && profile?.is_active !== false && profile?.company_id === tenant.id,
    )
    if (!matches) {
      await supabase.auth.signOut()
      const login = withTabQuery(new URL('/login', request.url), tabId)
      login.searchParams.set('error', 'portal')
      return respond(copyCookies(NextResponse.redirect(login)))
    }
    const trialExpired = isTrialExpired(tenant)
    if (trialExpired && (pathname === '/portal' || pathname.startsWith('/portal/'))) {
      return respond(copyCookies(rewriteToTenantPage(request, '/tenant/trial-expired', 200, tabId, tenant)))
    }
    const recoveryAttempt =
      request.nextUrl.searchParams.get('type') === 'recovery' ||
      request.nextUrl.searchParams.has('token_hash') ||
      request.nextUrl.searchParams.has('code')
    if (isGiftEmployee) {
      const onGift = pathname === '/gift' || pathname.startsWith('/gift/')
      if (pathname.startsWith('/login') && !recoveryAttempt) {
        return respond(copyCookies(NextResponse.redirect(withTabQuery(new URL('/gift', request.url), tabId))))
      }
      if (!onGift && !tenantCanSkipLogin(pathname)) {
        return respond(copyCookies(NextResponse.redirect(withTabQuery(new URL('/gift', request.url), tabId))))
      }
      return respond(supabaseResponse)
    }
    if (pathname.startsWith('/login') && !recoveryAttempt) {
      const dest = trialExpired ? '/tenant/trial-expired' : '/portal/gifts'
      return respond(copyCookies(NextResponse.redirect(withTabQuery(new URL(dest, request.url), tabId))))
    }
    const onPortal = pathname === '/portal' || pathname.startsWith('/portal/')
    if (!onPortal && !tenantCanSkipLogin(pathname)) {
      const dest = trialExpired ? '/tenant/trial-expired' : '/portal/gifts'
      return respond(copyCookies(NextResponse.redirect(withTabQuery(new URL(dest, request.url), tabId))))
    }
    return respond(supabaseResponse)
  }

  if (isPublicAuthPath(pathname) || isPublicSitePath(pathname)) {
    const recoveryAttempt =
      request.nextUrl.searchParams.get('type') === 'recovery' ||
      request.nextUrl.searchParams.has('token_hash') ||
      request.nextUrl.searchParams.has('code')
    if (user && isPublicAuthPath(pathname) && pathname.startsWith('/login') && !recoveryAttempt) {
      const next = request.nextUrl.searchParams.get('next')
      let destPath = isSafeNext(next) ? next : '/'
      if (!isSafeNext(next)) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
        destPath = landingPathForRole(profile?.role)
      }
      const dest = withTabQuery(new URL(destPath, request.url), tabId)
      const redirect = NextResponse.redirect(dest)
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return respond(redirect)
    }
    return respond(supabaseResponse)
  }

  if (!user) {
    const login = withTabQuery(new URL('/login', request.url), tabId)
    const intended = `${pathname}${search}`
    if (isSafeNext(intended)) login.searchParams.set('next', intended)
    const redirect = NextResponse.redirect(login)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return respond(redirect)
  }

  return respond(supabaseResponse)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
