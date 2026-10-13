import { createBrowserClient } from '@supabase/ssr'
import { authCookieOptions } from '@/lib/auth/cookie-options'
import { RECOVERY_COOKIE_NAME } from '@/lib/auth/tab'

export function createRecoveryBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: false,
      auth: {
        detectSessionInUrl: false,
      },
      cookieOptions: authCookieOptions(
        RECOVERY_COOKIE_NAME,
        typeof window === 'undefined' ? null : window.location.host,
      ),
    }
  )
}
