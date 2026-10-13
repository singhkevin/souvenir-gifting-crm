import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { authCookieOptions, localCookieWriteOptions } from '@/lib/auth/cookie-options'
import { authCookieName } from '@/lib/auth/tab'
import { getRequestTabId } from '@/lib/auth/tab-server'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const tabId = await getRequestTabId()
  const cookieName = authCookieName(tabId || 'none')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: authCookieOptions(cookieName, host),
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
