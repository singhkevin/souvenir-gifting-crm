import { appName } from '@/lib/brand'

/**
 * Resend settings are server-only and read at request time.
 * A dynamic `process.env` lookup stays on the Node process so a key set in
 * the host panel (Hostinger) is visible even when it was absent at build time.
 */
export function defaultResendFrom() {
  const name = appName().replace(/["\\]/g, '')
  return `"${name}" <onboarding@resend.dev>`
}

export const RESEND_NOT_CONFIGURED_ERROR =
  'Email delivery is not configured. Set RESEND_API_KEY in the server environment (see .env.example). To deliver to client addresses, set RESEND_FROM_EMAIL to a sender on a domain verified in Resend. Until then, copy the link or use Open mail app.'

type EnvSource = { [key: string]: string | undefined }

export function readServerEnv(env: EnvSource, name: string): string {
  const value = env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export type ResendConfig = {
  apiKey: string
  from: string
}

export function resendConfigFrom(env: EnvSource): ResendConfig | { error: string } {
  const apiKey = readServerEnv(env, 'RESEND_API_KEY')
  if (!apiKey) return { error: RESEND_NOT_CONFIGURED_ERROR }
  const from = readServerEnv(env, 'RESEND_FROM_EMAIL') || defaultResendFrom()
  return { apiKey, from }
}

export function resendConfig(): ResendConfig | { error: string } {
  const env = process.env
  return resendConfigFrom(env)
}

export function resendHttpError(status: number): string {
  if (status === 401 || status === 403) {
    return 'Resend rejected RESEND_API_KEY. Check the key in the server environment.'
  }
  if (status === 422) {
    return 'Resend rejected the sender address. Set RESEND_FROM_EMAIL to an address on a domain verified in Resend. The default onboarding@resend.dev address only delivers to the Resend account email.'
  }
  return 'Unable to send email right now.'
}
