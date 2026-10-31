import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { quoteCheckoutExpiry } from '@/lib/business/checkout-window'
import { customerQuoteCheckoutUrl } from '@/lib/quotes/public-link'
import { createAdminClient } from '@/lib/supabase/admin'

export function hashCheckoutToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function newCheckoutToken() {
  return randomBytes(32).toString('base64url')
}

export async function issueQuoteCheckoutLink(quotationId: string) {
  const admin = createAdminClient()
  if (!admin) return null
  const { data: quote, error } = await admin
    .from('quotations')
    .select('id, status, company_id, valid_until, quotation_number')
    .eq('id', quotationId)
    .maybeSingle()
  if (error || !quote || quote.status !== 'accepted' || !quote.company_id) return null

  const { data: company } = await admin
    .from('companies')
    .select('account_type, business_verification')
    .eq('id', quote.company_id)
    .maybeSingle()
  if (company?.account_type !== 'business' || company.business_verification !== 'verified') return null

  const { data: existing } = await admin.from('orders').select('id').eq('quotation_id', quotationId).maybeSingle()
  if (existing?.id) return { url: null, orderId: String(existing.id) }

  await admin
    .from('quote_checkout_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('quotation_id', quotationId)
    .is('used_at', null)

  const token = newCheckoutToken()
  const inserted = await admin.from('quote_checkout_tokens').insert({
    quotation_id: quotationId,
    company_id: quote.company_id,
    token_hash: hashCheckoutToken(token),
    expires_at: quoteCheckoutExpiry(quote.valid_until),
  })
  if (inserted.error) {
    console.error('[quote-token]', inserted.error.message)
    return null
  }
  return {
    url: customerQuoteCheckoutUrl(token),
    orderId: null,
  }
}
