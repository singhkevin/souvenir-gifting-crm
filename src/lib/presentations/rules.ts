import { randomBytes } from 'node:crypto'

export type ExpiryChoice = '30' | 'date' | 'none'

const DAY_MS = 24 * 60 * 60 * 1000

export function newShareToken() {
  return randomBytes(18).toString('base64url')
}

export function expiryFromChoice(
  choice: string,
  customDate: string,
  now = new Date(),
): { expiresAt: string | null } | { error: string } {
  if (choice === 'none') return { expiresAt: null }
  if (choice === '30') return { expiresAt: new Date(now.getTime() + 30 * DAY_MS).toISOString() }
  if (choice === 'date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(customDate)) return { error: 'Choose an expiry date.' }
    const end = new Date(`${customDate}T23:59:59.000Z`)
    if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) {
      return { error: 'Expiry must be a future date.' }
    }
    return { expiresAt: end.toISOString() }
  }
  return { error: 'Choose how long the link stays open.' }
}

export function linkIsOpen(
  link: { revokedAt: string | null; expiresAt: string | null },
  now = new Date(),
) {
  if (link.revokedAt) return false
  if (!link.expiresAt) return true
  const end = new Date(link.expiresAt)
  return !Number.isNaN(end.getTime()) && end.getTime() > now.getTime()
}

export function cleanSpecs(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 500)
}

export function parseMoney(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value * 100) / 100
  const text = String(value ?? '').trim().replace(/,/g, '')
  if (!text) return null
  const amount = Number(text)
  if (!Number.isFinite(amount) || amount < 0) return null
  return Math.round(amount * 100) / 100
}

export function parseMoq(value: unknown): number | null {
  const qty = Math.round(Number(value))
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return null
  return qty
}

export type PublicSlide = {
  title: string
  imageUrl: string | null
  specs: string
  moq: number
  kind: 'product' | 'combo'
  memberNames: string[]
}

/** Public pages keep the product story and drop every price. */
export function publicSlide(item: PublicSlide & { price?: number }): PublicSlide {
  return {
    title: item.title,
    imageUrl: item.imageUrl,
    specs: item.specs,
    moq: item.moq,
    kind: item.kind,
    memberNames: item.memberNames,
  }
}
