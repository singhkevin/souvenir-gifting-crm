import { roundMoney } from '@/lib/pricing/resolve'

/**
 * Pre-tax line amount after the quotation discount.
 * Tax is not included; it is added once on the accepted net.
 */
export function quoteLineTotal(quantity: number, unitPrice: number, discountPercent: number) {
  const qty = Number(quantity) || 0
  const unit = Number(unitPrice) || 0
  const discount = Number(discountPercent) || 0
  return roundMoney(qty * unit * (1 - discount / 100))
}

export type EstimateLine = {
  quantity: number
  unitPrice: number
  /** Pre-tax line amount. The quotation discount is already inside this figure. */
  lineTotal: number
  ticked?: boolean
}

/**
 * Accepted estimate.
 * Subtotal is the ticked gross (qty × unit). Discount is taken once
 * (subtotal − sum of pre-tax line totals). GST is added once on the net.
 * Total = subtotal − discount + tax, which equals sum(ticked line_total) + tax.
 */
export function estimateTickedLines(lines: EstimateLine[], taxPercent: number) {
  const ticked = lines.filter((line) => line.ticked !== false)
  const subtotal = roundMoney(
    ticked.reduce((sum, line) => sum + roundMoney((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)), 0),
  )
  const net = roundMoney(ticked.reduce((sum, line) => sum + (Number(line.lineTotal) || 0), 0))
  const discount = roundMoney(subtotal - net)
  const tax = roundMoney(net * ((Number(taxPercent) || 0) / 100))
  const total = roundMoney(subtotal - discount + tax)
  return { subtotal, discount, net, tax, total }
}

export type MarginWarningCode = 'missing_cost' | 'below_ten_percent' | 'above_sell'

export function marginWarnings(cost: number | null, sell: number): MarginWarningCode[] {
  if (cost == null || !Number.isFinite(cost)) return ['missing_cost']
  const sellValue = Number.isFinite(sell) ? sell : 0
  const warnings: MarginWarningCode[] = []
  if (sellValue > 0 && cost < sellValue * 0.1) warnings.push('below_ten_percent')
  if (cost > sellValue) warnings.push('above_sell')
  return warnings
}

export function marginWarningText(code: MarginWarningCode) {
  if (code === 'missing_cost') return 'Cost is empty'
  if (code === 'below_ten_percent') return 'Cost is under 10% of the sell price'
  return 'Cost is above the sell price'
}

/** Markup percent from cost to sell. Null when there is no positive cost. */
export function liveMarginPercent(cost: number | null, sell: number): number | null {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null
  if (!Number.isFinite(sell)) return null
  return roundMoney((sell / cost - 1) * 100)
}

/** Suggested sell from cost and margin. A default margin is not applied without a cost. */
export function suggestedSell(cost: number | null, marginPercent: number | null): number | null {
  if (cost == null || !Number.isFinite(cost) || cost < 0) return null
  if (marginPercent == null || !Number.isFinite(marginPercent)) return null
  return roundMoney(cost * (1 + marginPercent / 100))
}

export type SendRecipient = {
  key: string
  email: string
  label: string
  contactId: string | null
}

export function quoteSendRecipients(input: {
  contacts: { id: string; full_name: string | null; email: string | null }[]
  users: { id: string; full_name: string | null; email: string | null; role: string }[]
}): SendRecipient[] {
  const rows: SendRecipient[] = []
  const seen = new Set<string>()
  for (const contact of input.contacts) {
    const email = contact.email?.trim()
    if (!email) continue
    rows.push({
      key: `contact:${contact.id}`,
      email,
      label: `${contact.full_name || email} (contact)`,
      contactId: contact.id,
    })
    seen.add(email.toLowerCase())
  }
  for (const user of input.users) {
    const email = user.email?.trim()
    if (!email || seen.has(email.toLowerCase())) continue
    const kind = user.role === 'business_user' ? 'business' : 'client'
    rows.push({
      key: `user:${user.id}`,
      email,
      label: `${user.full_name || email} (${kind})`,
      contactId: null,
    })
  }
  return rows
}

/** Quote contact when that contact has an email; otherwise the first listed recipient. */
export function defaultQuoteRecipientKey(input: {
  contactId: string | null
  recipients: SendRecipient[]
}): string | null {
  if (input.contactId) {
    const match = input.recipients.find((row) => row.contactId === input.contactId)
    if (match) return match.key
  }
  return input.recipients[0]?.key ?? null
}

export function sendQuoteWarnings(lines: {
  name: string
  unitPrice: number
  cost: number | null
  applied: boolean
}[]): string[] {
  const warnings: string[] = []
  for (const line of lines) {
    if (!line.applied) warnings.push(`${line.name}: costing is not applied`)
    if (!(Number(line.unitPrice) > 0)) warnings.push(`${line.name}: sell price is 0`)
    if (line.cost != null && Number.isFinite(line.cost) && Number(line.unitPrice) < line.cost) {
      warnings.push(`${line.name}: sell price is below cost`)
    }
  }
  return warnings
}

export function clientQuotePath(accountType: string | null | undefined, quotationId: string) {
  return accountType === 'business'
    ? `/business/quotes/${quotationId}`
    : `/portal/quotations/${quotationId}`
}

/** Blank GST saves as 18. A stored number, including 0, is kept. */
export function draftGstPercent(stored: number | null | undefined, raw?: string): number {
  if (raw != null && raw.trim() === '') return 18
  if (raw != null && raw.trim() !== '') {
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : 18
  }
  if (stored == null || !Number.isFinite(Number(stored))) return 18
  return Number(stored)
}
