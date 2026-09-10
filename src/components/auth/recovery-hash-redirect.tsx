'use client'

import { useEffect } from 'react'

/** Redirects Supabase password-recovery hash links to /reset-password. */
export function RecoveryHashRedirect() {
  useEffect(() => {
    try {
      const hash = window.location.hash
      if (!hash || hash.length < 2) return
      const params = new URLSearchParams(hash.slice(1))
      const isRecovery =
        params.get('type') === 'recovery' ||
        (params.get('access_token') && params.get('refresh_token'))
      if (!isRecovery) return
      if (window.location.pathname.indexOf('/reset-password') === 0) return
      window.location.replace(`/reset-password${window.location.search}${window.location.hash}`)
    } catch {
      // ignore
    }
  }, [])

  return null
}
