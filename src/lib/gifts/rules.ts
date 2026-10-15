/** Pure rules for employee gift selection. Safe to import from tests and the browser. */

export const CONSUMER_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'mail.com',
  'rediffmail.com',
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  '10minutemail.com',
  'yopmail.com',
] as const

const CONSUMER = new Set<string>(CONSUMER_EMAIL_DOMAINS)

export type GiftChoiceInput = {
  name: string
  phone: string
  address: string
  city: string
  state: string
  pin: string
  size: string
  sizeOptions: string[]
}

export function emailDomainOf(email: string): string | null {
  const at = email.trim().toLowerCase().lastIndexOf('@')
  if (at < 1) return null
  const domain = email.trim().toLowerCase().slice(at + 1).replace(/^\.+|\.+$/g, '')
  if (!domain || !domain.includes('.') || /\s/.test(domain)) return null
  return domain
}

export function isConsumerEmailDomain(domain: string | null | undefined): boolean {
  return Boolean(domain && CONSUMER.has(domain))
}

/** Empty allow-list is closed. Consumer domains are refused even if listed. */
export function giftEmailProblem(email: string, allowedDomains: string[]): string | null {
  const domain = emailDomainOf(email)
  if (!domain) return 'Enter a company email address.'
  if (isConsumerEmailDomain(domain)) {
    return 'Use your company email. Public addresses such as Gmail are not accepted.'
  }
  const allowed = new Set(
    allowedDomains.map((entry) => entry.trim().toLowerCase()).filter(Boolean),
  )
  if (!allowed.has(domain)) {
    const list = [...allowed]
    return list.length
      ? `Use an email ending in ${list.map((item) => `@${item}`).join(' or ')}.`
      : 'This gift selection is not open for that email.'
  }
  return null
}

export function giftDomainListProblem(domains: string[]): string | null {
  const cleaned = domains.map((entry) => entry.trim().toLowerCase()).filter(Boolean)
  if (cleaned.length === 0) return 'Add at least one company email domain.'
  const blocked = cleaned.filter((domain) => isConsumerEmailDomain(domain))
  if (blocked.length) return `Remove public email domains: ${blocked.join(', ')}.`
  return null
}

export function giftWindowProblem(opensAt: string, closesAt: string, now = Date.now()): string | null {
  const opens = Date.parse(opensAt)
  const closes = Date.parse(closesAt)
  if (!Number.isFinite(opens) || !Number.isFinite(closes)) return 'Enter an open date and a close date.'
  if (closes <= opens) return 'The close date must be after the open date.'
  if (closes <= now) return null
  return null
}

export function giftWindowOpen(opensAt: string, closesAt: string, now = Date.now()): boolean {
  const opens = Date.parse(opensAt)
  const closes = Date.parse(closesAt)
  return Number.isFinite(opens) && Number.isFinite(closes) && now >= opens && now <= closes
}

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, '')
  if (!/^[0-9]{10}$/.test(digits)) return null
  return digits
}

export function normalizePin(raw: string): string | null {
  const digits = raw.replace(/\s/g, '')
  if (!/^[0-9]{6}$/.test(digits)) return null
  return digits
}

export function parseSizeOptions(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[,/|]+/)) {
    const size = part.trim()
    if (!size || size.length > 16 || seen.has(size.toLowerCase())) continue
    seen.add(size.toLowerCase())
    out.push(size)
    if (out.length >= 12) break
  }
  return out
}

export function giftChoiceProblem(input: GiftChoiceInput): string | null {
  if (!input.name.trim()) return 'Enter the employee name.'
  if (input.name.trim().length > 120) return 'Name is too long.'
  if (!normalizePhone(input.phone)) return 'Enter a 10-digit phone number.'
  if (!input.address.trim()) return 'Enter the shipping address.'
  if (input.address.trim().length > 300) return 'Address is too long.'
  if (!input.city.trim()) return 'Enter the city.'
  if (!input.state.trim()) return 'Enter the state.'
  if (!normalizePin(input.pin)) return 'Enter a 6-digit PIN.'
  const sizes = input.sizeOptions.map((size) => size.trim()).filter(Boolean)
  if (sizes.length > 0 && !sizes.includes(input.size.trim())) return 'Choose a size.'
  return null
}

export function giftChoiceLocked(alreadySubmitted: boolean): string | null {
  return alreadySubmitted ? 'This choice is locked and cannot be changed.' : null
}
