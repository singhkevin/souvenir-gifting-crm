import 'server-only'

import { hashCheckoutToken } from '@/lib/business/tokens'
import { notifyOrderPlaced } from '@/lib/email/order-emails'
import { createAdminClient } from '@/lib/supabase/admin'

export type QuoteCheckoutLine = {
  name: string
  sku: string
  quantity: number
  unitPrice: number
}

export type QuoteCheckoutView =
  | { ok: false; reason: 'invalid' | 'used' | 'expired' }
  | {
      ok: true
      token: string
      quotationNumber: string
      lines: QuoteCheckoutLine[]
      fullName: string
      email: string
      phone: string
      companyName: string
      total: number
    }

export async function loadQuoteCheckout(token: string): Promise<QuoteCheckoutView> {
  const admin = createAdminClient()
  if (!admin || token.length < 20) return { ok: false, reason: 'invalid' }
  const { data: row } = await admin
    .from('quote_checkout_tokens')
    .select('id, quotation_id, company_id, expires_at, used_at, order_id')
    .eq('token_hash', hashCheckoutToken(token))
    .maybeSingle()
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.used_at) return { ok: false, reason: 'used' }
  if (new Date(row.expires_at).getTime() <= Date.now()) return { ok: false, reason: 'expired' }

  const [{ data: quote }, { data: company }, { data: items }] = await Promise.all([
    admin.from('quotations').select('id, quotation_number, status, company_id, contact_id, discount_percent, tax_percent').eq('id', row.quotation_id).maybeSingle(),
    admin.from('companies').select('name, account_type, business_verification').eq('id', row.company_id).maybeSingle(),
    admin.from('quotation_items').select('description, quantity, unit_price, client_response, product:products(name, sku, status)').eq('quotation_id', row.quotation_id),
  ])
  if (!quote || quote.status !== 'accepted' || company?.account_type !== 'business' || company.business_verification !== 'verified') {
    return { ok: false, reason: 'invalid' }
  }

  const lines: QuoteCheckoutLine[] = []
  for (const item of items || []) {
    if (item.client_response !== 'accepted') continue
    const product = Array.isArray(item.product) ? item.product[0] : item.product
    if (!product || product.status !== 'active') return { ok: false, reason: 'invalid' }
    lines.push({
      name: product.name || item.description || 'Item',
      sku: product.sku || '',
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unit_price) || 0,
    })
  }
  if (!lines.length) return { ok: false, reason: 'invalid' }

  let contact: { full_name?: string | null; email?: string | null; phone?: string | null } | null = null
  if (quote.contact_id) {
    const { data } = await admin.from('contacts').select('full_name, email, phone').eq('id', quote.contact_id).maybeSingle()
    contact = data
  }
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const discount = subtotal * (Number(quote.discount_percent) || 0) / 100
  const tax = (subtotal - discount) * (Number(quote.tax_percent) || 0) / 100

  return {
    ok: true,
    token,
    quotationNumber: quote.quotation_number || 'Quotation',
    lines,
    fullName: contact?.full_name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    companyName: company.name || '',
    total: Math.round((subtotal - discount + tax) * 100) / 100,
  }
}

export async function placeQuoteOrder(input: {
  token: string
  fullName?: string
  email?: string
  phone?: string
}) {
  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to place this order just now. Please try again shortly.' }
  const { data, error } = await admin.rpc('place_quote_order', {
    p_token_hash: hashCheckoutToken(input.token),
    p_contact: {
      full_name: input.fullName || '',
      email: input.email || '',
      phone: input.phone || '',
    },
  })
  if (error || !data) {
    const message = error?.message || 'Unable to place this order'
    if (/already been used/i.test(message)) return { error: 'This checkout link has already been used.' }
    if (/expired/i.test(message)) return { error: 'This checkout link has expired.' }
    if (/not valid|not ready|not verified/i.test(message)) return { error: 'This checkout link is not valid.' }
    return { error: message }
  }
  const orderId = String(data)
  const { data: order } = await admin.from('orders').select('order_number, quotation_id').eq('id', orderId).maybeSingle()
  await notifyOrderPlaced(orderId)
  return { success: true, orderId, orderNumber: order?.order_number ? String(order.order_number) : undefined }
}
