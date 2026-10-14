import 'server-only'

export function clientIpFrom(headerStore: Headers) {
  const forwarded = headerStore.get('x-forwarded-for')
  const ip = (forwarded?.split(',')[0] || headerStore.get('x-real-ip') || 'unknown').trim()
  return ip.slice(0, 64) || 'unknown'
}

export async function verifyTurnstile(token: string | null | undefined, ip: string | null) {
  const secret = (process.env.TURNSTILE_SECRET_KEY || '').trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET_KEY is unset')
      return { ok: false, error: 'Server error. Please try again shortly.' }
    }
    console.warn('[turnstile] TURNSTILE_SECRET_KEY is unset; skipping verification outside production')
    return { ok: true }
  }
  const response = String(token || '').trim()
  if (!response) return { ok: false, error: 'Captcha failed. Please try again.' }
  try {
    const body = new URLSearchParams({ secret, response })
    if (ip && ip !== 'unknown') body.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json()) as { success?: boolean }
    if (!res.ok || !data.success) return { ok: false, error: 'Captcha failed. Please try again.' }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Captcha failed. Please try again.' }
  }
}
