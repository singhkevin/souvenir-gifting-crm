import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { authCookieOptions, localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/tab'
import { confirmLandingForRole, isAccountConfirmType } from '@/lib/auth/confirm-landing'
import { settlePortalSignup } from '@/lib/portal/signup-server'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { hostLoginDecision } from '@/lib/domain-routing'
import { isClientRole, isGiftEmployeeRole } from '@/lib/roles'
import { resolveHost, resolveTenantBySlug } from '@/lib/portal-host'
import type { SupabaseClient } from '@supabase/supabase-js'

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

async function rejectForeignSession(
  request: NextRequest,
  supabase: SupabaseClient,
  pendingCookies: PendingCookie[],
) {
  if (!domainSplitEnabled()) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, company_id, is_active')
    .eq('id', user.id)
    .maybeSingle()
  if (profile?.is_active === false) {
    await supabase.auth.signOut()
    return redirectWithCookies(request, '/login?error=inactive', pendingCookies)
  }
  let portalSlug: string | null = null
  const microsite = isClientRole(profile?.role) || isGiftEmployeeRole(profile?.role)
  if (profile && microsite && profile.company_id) {
    const { data: company } = await supabase
      .from('companies')
      .select('portal_slug')
      .eq('id', profile.company_id)
      .maybeSingle()
    portalSlug = company?.portal_slug ?? null
  }
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const resolved = resolveHost(host)
  const tenant = resolved.kind === 'tenant' ? await resolveTenantBySlug(resolved.slug) : null
  const decision = hostLoginDecision({
    host: resolved,
    role: profile?.role,
    companyId: profile?.company_id ?? null,
    tenantCompanyId: tenant?.id ?? null,
    portalSlug,
  })
  if (decision.allow) return null
  await supabase.auth.signOut()
  return redirectWithCookies(request, decision.href, pendingCookies)
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

  const rawType = incoming.searchParams.get('type')
  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) {
      return NextResponse.redirect(new URL(isAccountConfirmType(rawType) ? '/login?error=confirm' : '/reset-password?error=invalid', incoming.origin))
    }
    const rejected = await rejectForeignSession(request, supabase, pendingCookies)
    if (rejected) return rejected
    const { data: { user } } = await supabase.auth.getUser()
    if (user && isAccountConfirmType(rawType)) await settlePortalSignup(user.id)
    const { data: profile } = user
      ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      : { data: null }
    const landing = confirmLandingForRole(profile?.role, rawType, incoming.searchParams.get('next'))
    if (landing) return redirectWithCookies(request, landing, pendingCookies)
    return redirectWithCookies(request, '/reset-password', cookiesForRedirect(request, pendingCookies))
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code as string)
  if (error) {
    return NextResponse.redirect(new URL(isAccountConfirmType(rawType) ? '/login?error=confirm' : '/reset-password?error=invalid', incoming.origin))
  }
  const rejected = await rejectForeignSession(request, supabase, pendingCookies)
  if (rejected) return rejected
  const { data: { user } } = await supabase.auth.getUser()
  if (user && isAccountConfirmType(rawType)) await settlePortalSignup(user.id)
  const { data: profile } = user
    ? await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    : { data: null }
  const landing = confirmLandingForRole(profile?.role, rawType, incoming.searchParams.get('next'))
  if (landing) return redirectWithCookies(request, landing, pendingCookies)
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

