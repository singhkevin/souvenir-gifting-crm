/** Offline GSTIN check. Does not call a live tax API. */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38',
])

export function normaliseGstin(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '')
}

export function gstinCheckDigit(body: string) {
  let factor = 2
  let sum = 0
  const mod = 36
  for (let i = body.length - 1; i >= 0; i -= 1) {
    const code = CHARSET.indexOf(body[i])
    if (code < 0) return ''
    let digit = factor * code
    factor = factor === 2 ? 1 : 2
    digit = Math.floor(digit / mod) + (digit % mod)
    sum += digit
  }
  return CHARSET[(mod - (sum % mod)) % mod]
}

/** Registration requires a GSTIN. A blank value is still valid for optional CRM fields. */
export function gstinRequiredError(value: string | null | undefined): string | null {
  if (!normaliseGstin(value)) return 'GSTIN is required'
  return gstinError(value)
}

export function gstinError(value: string | null | undefined): string | null {
  const gstin = normaliseGstin(value)
  if (!gstin) return null
  if (!GSTIN_RE.test(gstin)) return 'Invalid GSTIN. Enter the 15-character number.'
  if (!STATE_CODES.has(gstin.slice(0, 2))) return 'Invalid GSTIN. The state code is not valid.'
  if (gstinCheckDigit(gstin.slice(0, 14)) !== gstin[14]) return 'Invalid GSTIN. The check digit does not match.'
  return null
}

export function isValidGstin(value: string | null | undefined) {
  return gstinError(value) === null
}
