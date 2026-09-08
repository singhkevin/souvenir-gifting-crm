import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isSafeNext } from '@/lib/safe-next'
import { TAB_HEADER, TAB_QUERY, authCookieName, isPublicAuthPath, isPublicSitePath, isTabId } from '@/lib/auth/tab'

function withTabHeader(request: NextRequest, tabId: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TAB_HEADER, tabId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

function withTabQuery(url: URL, tabId: string) {
  url.searchParams.set(TAB_QUERY, tabId)
  return url
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const queryTab = request.nextUrl.searchParams.get(TAB_QUERY)
  const headerTab = request.headers.get(TAB_HEADER)
  const tabId = isTabId(headerTab) ? headerTab : isTabId(queryTab) ? queryTab : null

  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next({ request })
  }

  if (!isTabId(tabId)) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = withTabHeader(request, tabId)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: authCookieName(tabId) },
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = withTabHeader(request, tabId)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (isPublicAuthPath(pathname) || isPublicSitePath(pathname)) {
    const recoveryAttempt =
      request.nextUrl.searchParams.get('type') === 'recovery' ||
      request.nextUrl.searchParams.has('token_hash') ||
      request.nextUrl.searchParams.has('code')
    if (user && isPublicAuthPath(pathname) && pathname.startsWith('/login') && !recoveryAttempt) {
      const next = request.nextUrl.searchParams.get('next')
      const dest = withTabQuery(new URL(isSafeNext(next) ? next : '/', request.url), tabId)
      const redirect = NextResponse.redirect(dest)
      supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return redirect
    }
    return supabaseResponse
  }

  if (!user) {
    const login = withTabQuery(new URL('/login', request.url), tabId)
    const intended = `${pathname}${search}`
    if (isSafeNext(intended)) login.searchParams.set('next', intended)
    const redirect = NextResponse.redirect(login)
    supabaseResponse.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
