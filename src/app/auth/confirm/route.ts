import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authCookieOptions, localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/tab'
import { isSafeNext } from '@/lib/safe-next'

type PendingCookie = {
  name: string
  value: string
  options?: {
    path?: string
    sameSite?: 'lax' | 'strict' | 'none' | boolean
    httpOnly?: boolean
    maxAge?: number
    secure?: boolean
    domain?: string
    expires?: Date
  }
}

function otpType(value: string | null): EmailOtpType {
  if (value === 'recovery' || value === 'email' || value === 'magiclink') return value
  return 'recovery'
}

function redirectWithCookies(
  request: NextRequest,
  path: string,
  cookiesToCopy?: PendingCookie[],
) {
  const url = new URL(path, request.nextUrl.origin)
  const response = NextResponse.redirect(url)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  cookiesToCopy?.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, localCookieWriteOptions(options, host))
  })
  return response
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl
  const code = incoming.searchParams.get('code')
  const tokenHash = incoming.searchParams.get('token_hash')
  const type = otpType(incoming.searchParams.get('type'))

  // No query credential: hash tokens are client-only. Pass through to the form.
  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL('/reset-password', incoming.origin))
  }

  const pendingCookies: PendingCookie[] = []
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(
        RECOVERY_COOKIE_NAME,
        request.headers.get('x-forwarded-host') || request.headers.get('host'),
      ),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: PendingCookie[]) {
          pendingCookies.length = 0
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            pendingCookies.push({ name, value, options })
          })
        },
      },
    },
  )

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      return NextResponse.redirect(new URL(type === 'recovery' ? '/reset-password?error=invalid' : '/login?error=confirm', incoming.origin))
    }
    if (type !== 'recovery') {
      const next = incoming.searchParams.get('next')
      if (next === '/gift') {
        return redirectWithCookies(request, next, clearedRecoveryCookies(request, pendingCookies))
      }
      return redirectWithCookies(request, `/login?confirmed=1&next=${isSafeNext(next) ? encodeURIComponent(next) : '/business/dashboard'}`, clearedRecoveryCookies(request, pendingCookies))
    }
    return redirectWithCookies(request, '/reset-password', cookiesForRedirect(request, pendingCookies))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code as string)
  if (error) {
    return NextResponse.redirect(new URL('/reset-password?error=invalid', incoming.origin))
  }
  return redirectWithCookies(request, '/reset-password', cookiesForRedirect(request, pendingCookies))
}

function cookiesForRedirect(
  request: NextRequest,
  pending: PendingCookie[],
) {
  if (pending.length) return pending
  return request.cookies.getAll()
    .filter((cookie) => cookie.name === RECOVERY_COOKIE_NAME || cookie.name.startsWith(`${RECOVERY_COOKIE_NAME}.`))
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
      options: { path: '/', sameSite: 'lax' as const, httpOnly: true },
    }))
}

function clearedRecoveryCookies(
  request: NextRequest,
  pending: PendingCookie[],
) {
  const names = new Set<string>([
    ...pending.map((cookie) => cookie.name),
    ...request.cookies.getAll()
      .filter((cookie) => cookie.name === RECOVERY_COOKIE_NAME || cookie.name.startsWith(`${RECOVERY_COOKIE_NAME}.`))
      .map((cookie) => cookie.name),
  ])
  return [...names].map((name) => ({
    name,
    value: '',
    options: { path: '/', sameSite: 'lax' as const, httpOnly: true, maxAge: 0 },
  }))
}
