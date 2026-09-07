import { createServerClient } from '@supabase/ssr'
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/tab'

function otpType(value: string | null): EmailOtpType {
  if (value === 'recovery' || value === 'email' || value === 'magiclink') return value
  return 'recovery'
}

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl
  const code = incoming.searchParams.get('code')
  const tokenHash = incoming.searchParams.get('token_hash')
  const type = otpType(incoming.searchParams.get('type'))

  const success = new URL('/reset-password', incoming.origin)
  const invalid = new URL('/reset-password', incoming.origin)
  invalid.searchParams.set('error', 'invalid')

  if (!code && !tokenHash) {
    return NextResponse.redirect(success)
  }

  let response = NextResponse.redirect(success)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: RECOVERY_COOKIE_NAME,
        path: '/',
        sameSite: 'lax',
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (error) return NextResponse.redirect(invalid)
    return response
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code as string)
  if (error) return NextResponse.redirect(invalid)
  return response
}
