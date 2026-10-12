'use client'

import { useEffect } from 'react'

const SCRIPT_ID = 'cf-turnstile-script'

export function TurnstileWidget() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

  useEffect(() => {
    if (!siteKey || document.getElementById(SCRIPT_ID)) return
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    document.head.appendChild(script)
  }, [siteKey])

  if (!siteKey) return null
  return <div className="cf-turnstile" data-sitekey={siteKey} />
}
