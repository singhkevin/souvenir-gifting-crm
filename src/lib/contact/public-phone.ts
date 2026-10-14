/** Env wins, then org_settings.public_contact_phone. Blank means the public site shows no phone. */
export function resolvePublicContactPhone(
  envValue: string | null | undefined,
  settingsValue: string | null | undefined,
): string | null {
  const env = String(envValue || '').trim()
  if (env) return env
  const settings = String(settingsValue || '').trim()
  return settings || null
}

export function whatsAppHref(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 8) return null
  return `https://wa.me/${digits}`
}
