import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { authCookieOptions, localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/tab'

export async function createRecoveryServerClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(RECOVERY_COOKIE_NAME, host),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, localCookieWriteOptions(options, host))
            )
          } catch {
            // Ignored in Server Component
          }
        },
      },
    }
  )
}
