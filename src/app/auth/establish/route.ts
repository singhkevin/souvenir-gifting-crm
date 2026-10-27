import { NextRequest, NextResponse } from 'next/server'
import { localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { isRecoveryAuthCookie, isRecoverySessionCookie, sessionCookieNameFromRecovery } from '@/lib/auth/session-handoff'
import { TAB_QUERY, isTabId } from '@/lib/auth/tab'
import { isSafeNext } from '@/lib/safe-next'

export const dynamic = 'force-dynamic'

const COOKIE_MAX_AGE = 400 * 24 * 60 * 60

function cookieOptions(host: string | null, maxAge: number) {
  return localCookieWriteOptions(
    { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge },
    host,
  )
}

function landingPath(next: string | null) {
  return isSafeNext(next) ? next : '/business/dashboard'
}

function establishHtml() {
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="robots" content="noindex">
<title>Signing you in</title>
<p>Signing you in…</p>
<script>
  const key = 'giffter.tab-id'
  let id = sessionStorage.getItem(key)
  if (!id || !/^[a-f0-9]{16}$/.test(id)) {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem(key, id)
  }
  const url = new URL(location.href)
  url.searchParams.set('giffter_tab', id)
  location.replace(url.toString())
</script>
`
}

export function GET(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const next = request.nextUrl.searchParams.get('next')
  const tabId = request.nextUrl.searchParams.get(TAB_QUERY)
  const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' }

  if (!isTabId(tabId)) {
    return new NextResponse(establishHtml(), { headers })
  }

  const sessionCookies = request.cookies.getAll().filter((cookie) => cookie.value && isRecoverySessionCookie(cookie.name))
  if (!sessionCookies.length) {
    const login = new URL('/login', request.nextUrl.origin)
    login.searchParams.set('error', 'confirm')
    const safeNext = landingPath(next)
    if (isSafeNext(safeNext)) login.searchParams.set('next', safeNext)
    return NextResponse.redirect(login, { headers: { 'Cache-Control': 'no-store' } })
  }

  const dest = new URL(landingPath(next), request.nextUrl.origin)
  dest.searchParams.set(TAB_QUERY, tabId)
  const response = NextResponse.redirect(dest, { headers: { 'Cache-Control': 'no-store' } })
  for (const cookie of sessionCookies) {
    const name = sessionCookieNameFromRecovery(cookie.name, tabId)
    if (!name) continue
    response.cookies.set(name, cookie.value, cookieOptions(host, COOKIE_MAX_AGE))
  }
  for (const cookie of request.cookies.getAll()) {
    if (!isRecoveryAuthCookie(cookie.name)) continue
    response.cookies.set(cookie.name, '', cookieOptions(host, 0))
  }
  return response
}
