import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function newPublicOrderToken() {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashPublicOrderToken(token) }
}

export function hashPublicOrderToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function publicOrderTokenMatches(token: string, hash: string | null | undefined) {
  if (!token || !hash) return false
  const actual = hashPublicOrderToken(token)
  const left = Buffer.from(actual)
  const right = Buffer.from(hash)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
