/**
 * Public (retail / website) quote requests.
 *
 * The public form posts either one product (product_id + product_name), a cart
 * (items_json) or nothing (a generic enquiry). Every request becomes a lead plus a
 * `requirements` row with source 'website', so staff can quote it from /crm/requirements.
 * These helpers are pure so the mapping can be unit tested.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PUBLIC_QUOTE_MAX_QTY = 100000
export const PUBLIC_QUOTE_MAX_LINES = 50

export type PublicQuoteItemInput = { id: string; name: string; quantity: number }
export type PublicQuoteProduct = { id: string; name: string; sku: string | null }
export type PublicQuoteLine = {
  /** Null when the product could not be matched to an active public catalogue product. */
  productId: string | null
  name: string
  sku: string | null
  quantity: number
}

/** First whole number in the free-text quantity ("50", "50-100", "approx 200 units"), clamped to 1..100000. */
export function parseQuoteQuantity(raw: string | null | undefined): number | null {
  const match = String(raw || '').replace(/,/g, '').match(/\d+/)
  if (!match) return null
  const value = Number(match[0])
  if (!Number.isFinite(value) || value < 1) return null
  return Math.min(Math.round(value), PUBLIC_QUOTE_MAX_QTY)
}

/** Cart lines from the hidden items_json field. Bad JSON or rows are dropped. */
export function parseQuoteItems(raw: string | null | undefined): PublicQuoteItemInput[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((row) => row && typeof row === 'object' && row.id && row.name)
      .slice(0, PUBLIC_QUOTE_MAX_LINES)
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        quantity: Math.min(Math.max(1, Math.round(Number(row.quantity) || 1)), PUBLIC_QUOTE_MAX_QTY),
      }))
  } catch {
    return []
  }
}

/** Product ids worth looking up in the catalogue. */
export function quoteProductIds(input: { items: PublicQuoteItemInput[]; productId?: string | null }): string[] {
  const ids = input.items.length ? input.items.map((item) => item.id) : input.productId ? [input.productId] : []
  return [...new Set(ids.filter((id) => UUID.test(id)))]
}

/**
 * Resolve what the visitor asked about into lines. Matched products carry their id and SKU;
 * unmatched ones keep the name the form sent so the enquiry is never silently lost.
 */
export function resolvePublicQuoteLines(input: {
  items: PublicQuoteItemInput[]
  productId?: string | null
  productName?: string | null
  quantity?: string | null
  products: PublicQuoteProduct[]
}): PublicQuoteLine[] {
  const byId = new Map(input.products.map((product) => [product.id, product]))
  const raw: PublicQuoteLine[] = []
  if (input.items.length) {
    for (const item of input.items) {
      const match = byId.get(item.id)
      raw.push({
        productId: match?.id ?? null,
        name: match?.name || item.name,
        sku: match?.sku ?? null,
        quantity: item.quantity,
      })
    }
  } else {
    const match = input.productId ? byId.get(input.productId) : undefined
    const name = match?.name || String(input.productName || '').trim()
    if (match || name) {
      raw.push({
        productId: match?.id ?? null,
        name: name || 'Product',
        sku: match?.sku ?? null,
        quantity: parseQuoteQuantity(input.quantity) ?? 1,
      })
    }
  }

  // requirement_products is unique per (requirement, product): merge repeats.
  const lines: PublicQuoteLine[] = []
  const seen = new Map<string, PublicQuoteLine>()
  for (const line of raw) {
    if (line.productId) {
      const existing = seen.get(line.productId)
      if (existing) {
        existing.quantity = Math.min(existing.quantity + line.quantity, PUBLIC_QUOTE_MAX_QTY)
        continue
      }
      const copy = { ...line }
      seen.set(line.productId, copy)
      lines.push(copy)
    } else {
      lines.push({ ...line })
    }
  }
  return lines
}

export function quoteLineLabel(line: Pick<PublicQuoteLine, 'name' | 'sku'>): string {
  return line.sku ? `${line.name} (${line.sku})` : line.name
}

export type PublicQuoteRecord = {
  leadNotes: string
  requirementName: string
  requirementQuantity: number
  requirementDescription: string
  /** Lines that can be stored in requirement_products. */
  requirementProducts: { product_id: string; quantity: number }[]
  /** Short product summary for notifications, emails and the thank-you message. Null for a generic enquiry. */
  productSummary: string | null
  notificationBody: string
}

export function buildPublicQuoteRecord(input: {
  companyName: string
  contactName?: string | null
  lines: PublicQuoteLine[]
  quantity?: string | null
  message?: string | null
  phone?: string | null
}): PublicQuoteRecord {
  const { lines } = input
  const quantityText = String(input.quantity || '').trim()
  const message = String(input.message || '').trim()
  const isCart = lines.length > 1

  let productBlock = ''
  if (lines.length === 1) {
    productBlock = `Product: ${quoteLineLabel(lines[0])}`
  } else if (lines.length > 1) {
    productBlock = 'Products:\n' + lines.map((line) => `  - ${quoteLineLabel(line)} x ${line.quantity}`).join('\n')
  }

  const quantityLine = !isCart && quantityText ? `Quantity: ${quantityText}` : ''
  const leadNotes = ['Website catalogue enquiry', productBlock, quantityLine, message].filter(Boolean).join('\n')

  const first = lines[0]
  const productSummary = first
    ? lines.length > 1
      ? `${first.name} +${lines.length - 1} more`
      : first.name
    : null

  const requirementName = (productSummary ? `Website RFQ: ${productSummary}` : `Website enquiry: ${input.companyName}`).slice(0, 180)

  const requirementProducts = lines
    .filter((line): line is PublicQuoteLine & { productId: string } => Boolean(line.productId))
    .map((line) => ({ product_id: line.productId, quantity: line.quantity }))

  const unmatched = lines.filter((line) => !line.productId)
  const requirementQuantity = lines.length
    ? Math.max(1, Math.min(lines.reduce((sum, line) => sum + line.quantity, 0), PUBLIC_QUOTE_MAX_QTY))
    : parseQuoteQuantity(quantityText) ?? 1

  const requirementDescription = [
    'Submitted from the public website quote form.',
    input.contactName ? `Contact: ${input.contactName}` : '',
    input.phone ? `Phone: ${input.phone}` : '',
    productBlock,
    quantityLine,
    unmatched.length
      ? `Not matched to a catalogue product: ${unmatched.map((line) => quoteLineLabel(line)).join(', ')}. Add it on the Products tab.`
      : '',
    !lines.length ? 'No product selected. Add products on the Products tab before creating a quotation.' : '',
    message ? `Message:\n${message}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)

  const qtyNote = !isCart && first ? ` x ${first.quantity}` : ''
  const notificationBody = productSummary
    ? `${input.companyName} asked for a quote: ${productSummary}${qtyNote}.`
    : `${input.companyName} asked for a quote.`

  return {
    leadNotes,
    requirementName,
    requirementQuantity,
    requirementDescription,
    requirementProducts,
    productSummary,
    notificationBody,
  }
}
