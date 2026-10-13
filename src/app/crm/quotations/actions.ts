'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getProfile, type ProfileSession } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { requestOrigin } from '@/lib/auth/request-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessQuoteSentEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { absoluteClientQuoteUrl } from '@/lib/quotes/client-link'
import { clientQuotePath, quoteLineTotal } from '@/lib/quotes/flow'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'
import { isUuid } from '@/lib/utils'
import { supplierSchemaHint } from '@/lib/pricing/surfaces'
import { withIdempotency } from '@/lib/idempotency'
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  viewed: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: [],
  expired: ['sent'],
}

const RESPONSE_STATUSES = new Set(['accepted', 'rejected'])

function staleQuotationMessage(message: string) {
  return /cannot be responded to|already/i.test(message)
    ? 'This quotation was already updated. Refresh to see its current status.'
    : message
}

export async function updateQuotationStatus(quotationId: string, newStatus: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to change quotation status' }
  }

  const supabase = await createClient()
  const { data: quote, error: readError } = await supabase
    .from('quotations')
    .select('id, status, requirement_id')
    .eq('id', quotationId)
    .maybeSingle()
  if (readError) return { error: readError.message }
  if (!quote) return { error: 'Quotation not found' }

  const current = quote.status || 'draft'
  if (!(ALLOWED_TRANSITIONS[current] || []).includes(newStatus)) {
    return { error: `A ${current} quotation cannot move to ${newStatus}` }
  }

  if (RESPONSE_STATUSES.has(newStatus)) {
    const { error } = await supabase.rpc('respond_quotation', {
      p_quotation_id: quotationId,
      p_status: newStatus,
      p_comment: null,
    })
    if (error) return { error: staleQuotationMessage(error.message) }
  } else {
    // Only apply while the quotation is still in the status we validated: a second click finds 0 rows.
    const { data: updated, error } = await supabase
      .from('quotations')
      .update({ status: newStatus })
      .eq('id', quotationId)
      .eq('status', current)
      .select('id')
    if (error) return { error: error.message }
    if (!updated?.length) {
      return { error: 'This quotation was already updated. Refresh to see its current status.' }
    }
  }

  await writeAudit(supabase, {
    action: 'status_change',
    entity: 'quotations',
    entityId: quotationId,
    previous: { status: current },
    next: { status: newStatus },
    userId: profile.id,
  })

  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/crm/quotations')
  if (quote.requirement_id) {
    revalidatePath(`/crm/requirements/${quote.requirement_id}`)
  }
  if (current === 'draft' && newStatus === 'sent') {
    await supersedePreviousQuotation(supabase, quotationId)
  }
  return { success: true }
}
export async function convertToOrder(quotationId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales'].includes(profile.role)) {
    return { error: 'Not permitted to convert quotations' }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('convert_quotation_to_order', { p_quotation_id: quotationId })
  if (error) {
    // orders_quotation_id_key (one order per quotation) fired: another request created it first. Go to that order.
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('orders').select('id').eq('quotation_id', quotationId).maybeSingle()
      if (existing?.id) redirect(`/crm/orders/${existing.id}`)
    }
    return { error: error.message }
  }
  await writeAudit(supabase, {
    action: 'create',
    entity: 'orders',
    entityId: data,
    next: { quotation_id: quotationId },
    userId: profile.id,
  })
  const { notifyOrderPlaced } = await import('@/lib/email/order-emails')
  await notifyOrderPlaced(String(data), { includeStaff: false })
  redirect(`/crm/orders/${data}`)
}
export async function applyQuotationItemPrice(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management', 'accounts'].includes(profile.role)) {
    return { error: 'Not permitted to cost quotations' }
  }

  const quotationId = String(formData.get('quotation_id') || '')
  const itemId = String(formData.get('item_id') || '')
  const offerId = String(formData.get('supplier_offer_id') || '')
  const costRaw = String(formData.get('supplier_cost') ?? '').trim()
  if (!costRaw) return { error: 'Enter a cost before applying' }
  const cost = Number(costRaw)
  const margin = Number(formData.get('margin_percent'))
  const unit = Number(formData.get('unit_price'))
  if (!isUuid(quotationId) || !isUuid(itemId)) return { error: 'Quotation line not found' }
  if (!Number.isFinite(cost) || cost < 0) return { error: 'Enter a supplier cost of zero or more' }
  if (!Number.isFinite(margin) || margin < 0) return { error: 'Enter a margin of zero or more' }
  if (!Number.isFinite(unit) || unit < 0) return { error: 'Enter a sell price of zero or more' }

  const supabase = await createClient()
  const { data: quote } = await supabase.from('quotations').select('id, status, discount_percent').eq('id', quotationId).maybeSingle()
  if (!quote) return { error: 'Quotation not found' }
  if (quote.status !== 'draft') return { error: 'Only a draft quotation can be repriced' }

  const { data: item } = await supabase
    .from('quotation_items')
    .select('id, quantity')
    .eq('id', itemId)
    .eq('quotation_id', quotationId)
    .maybeSingle()
  if (!item) return { error: 'Quotation line not found' }

  const quantity = Number(item.quantity) || 1
  const lineTotal = quoteLineTotal(quantity, unit, Number(quote.discount_percent) || 0)
  const { error: priceError } = await supabase
    .from('quotation_items')
    .update({ unit_price: unit, line_total: lineTotal })
    .eq('id', itemId)
  if (priceError) return { error: priceError.message }

  const { error: costError } = await supabase.from('quotation_item_costs').upsert({
    quotation_item_id: itemId,
    supplier_offer_id: isUuid(offerId) ? offerId : null,
    supplier_cost: cost,
    margin_percent: margin,
    updated_at: new Date().toISOString(),
  })
  if (costError) return { error: supplierSchemaHint(costError.message) }

  const { error: recalcError } = await supabase.rpc('recalc_quotation_totals', { p_quotation_id: quotationId })
  if (recalcError) return { error: recalcError.message }
  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/crm/quotations')
  return { success: true }
}

export async function duplicateQuotation(quotationId: string, idempotencyKey?: string) {
  return withIdempotency('crm.duplicateQuotation', idempotencyKey, async () => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('duplicate_quotation', { p_quotation_id: quotationId })
    if (error) return { error: error.message }
    redirect(`/crm/quotations/${data}`)
  })
}

export async function createQuotationRevision(quotationId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to revise quotations' }
  }
  const supabase = await createClient()
  const existing = await supabase
    .from('quotations')
    .select('id')
    .eq('revision_of', quotationId)
    .eq('status', 'draft')
    .maybeSingle()
  if (existing.data?.id) redirect(`/crm/quotations/${existing.data.id}`)
  if (existing.error && /revision_of/i.test(existing.error.message)) {
    return { error: 'Apply the 20261012 business portal migrations, then retry.' }
  }

  const { data, error } = await supabase.rpc('duplicate_quotation', { p_quotation_id: quotationId })
  if (error || !data) return { error: error?.message || 'Unable to duplicate this quotation' }
  const linked = await supabase.from('quotations').update({ revision_of: quotationId }).eq('id', data)
  if (linked.error) return { error: linked.error.message }
  redirect(`/crm/quotations/${data}`)
}

async function supersedePreviousQuotation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quotationId: string,
) {
  const { data: quote } = await supabase
    .from('quotations')
    .select('quotation_number, revision_of')
    .eq('id', quotationId)
    .maybeSingle()
  if (!quote?.revision_of) return
  await supabase
    .from('quotations')
    .update({ status: 'rejected', client_comment: `Superseded by ${quote.quotation_number}` })
    .eq('id', quote.revision_of)
    .in('status', ['sent', 'viewed', 'draft'])
}

function percentError(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return `${label} must be between 0 and 100`
  return null
}

type DraftContext = {
  profile: ProfileSession
  supabase: Awaited<ReturnType<typeof createClient>>
  quote: {
    id: string
    status: string | null
    company_id: string
    discount_percent: number | null
    tax_percent: number | null
  }
}

async function assertDraft(quotationId: string): Promise<{ error: string } | DraftContext> {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to edit this quotation' }
  }
  const supabase = await createClient()
  const { data: quote, error } = await supabase
    .from('quotations')
    .select('id, status, company_id, discount_percent, tax_percent')
    .eq('id', quotationId)
    .maybeSingle()
  if (error) return { error: error.message }
  if (!quote) return { error: 'Quotation not found' }
  if (quote.status !== 'draft') return { error: 'Only a draft quotation can be edited' }
  return { profile, supabase, quote }
}

async function recalcQuote(supabase: Awaited<ReturnType<typeof createClient>>, quotationId: string) {
  const { error } = await supabase.rpc('recalc_quotation_totals', { p_quotation_id: quotationId })
  if (!error) return null
  return /recalc_quotation_totals/i.test(error.message)
    ? `${error.message} Apply supabase/migrations/20261014_quote_line_totals.sql, then retry.`
    : error.message
}

export async function saveQuotationDraft(quotationId: string, patch: {
  discountPercent?: number
  taxPercent?: number
  validUntil?: string | null
  notes?: string | null
  lineId?: string
  quantity?: number
}) {
  if (!isUuid(quotationId)) return { error: 'Quotation not found' }
  const draft = await assertDraft(quotationId)
  if ('error' in draft) return { error: draft.error }
  const { supabase } = draft
  const header: Record<string, string | number | null> = {}
  if (patch.discountPercent != null) {
    const message = percentError(patch.discountPercent, 'Discount')
    if (message) return { error: message }
    header.discount_percent = patch.discountPercent
  }
  if (patch.taxPercent != null) {
    const message = percentError(patch.taxPercent, 'GST')
    if (message) return { error: message }
    header.tax_percent = patch.taxPercent
  }
  if (patch.validUntil !== undefined) {
    const value = patch.validUntil?.trim() || null
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: 'Enter a valid date' }
    header.valid_until = value
  }
  if (patch.notes !== undefined) header.notes = patch.notes?.slice(0, 8000) || null
  if (Object.keys(header).length) {
    const { error } = await supabase.from('quotations').update(header).eq('id', quotationId).eq('status', 'draft')
    if (error) return { error: error.message }
  }
  if (patch.lineId) {
    if (!isUuid(patch.lineId)) return { error: 'Quotation line not found' }
    const quantity = Math.round(Number(patch.quantity))
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return { error: 'Quantity must be a whole number from 1 to 100000' }
    }
    const { error } = await supabase
      .from('quotation_items')
      .update({ quantity })
      .eq('id', patch.lineId)
      .eq('quotation_id', quotationId)
    if (error) return { error: error.message }
  }
  const recalcError = await recalcQuote(supabase, quotationId)
  if (recalcError) return { error: recalcError }
  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/crm/quotations')
  return { success: true }
}

export async function removeQuotationLine(quotationId: string, lineId: string) {
  if (!isUuid(quotationId) || !isUuid(lineId)) return { error: 'Quotation line not found' }
  const draft = await assertDraft(quotationId)
  if ('error' in draft) return { error: draft.error }
  const { error } = await draft.supabase.from('quotation_items').delete().eq('id', lineId).eq('quotation_id', quotationId)
  if (error) return { error: error.message }
  const recalcError = await recalcQuote(draft.supabase, quotationId)
  if (recalcError) return { error: recalcError }
  revalidatePath(`/crm/quotations/${quotationId}`)
  return { success: true }
}

export async function searchQuoteProducts(quotationId: string, query: string) {
  const draft = await assertDraft(quotationId)
  if ('error' in draft) return { error: draft.error }
  const term = query.trim().replace(/[%_,]/g, '')
  if (term.length < 2) return { error: 'Type at least 2 characters' }
  const { data, error } = await draft.supabase
    .from('products')
    .select('id, name, sku, moq, price')
    .eq('status', 'active')
    .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
    .order('name')
    .limit(20)
  if (error) return { error: error.message }
  return { products: data || [] }
}

export async function addQuotationProduct(quotationId: string, productId: string) {
  if (!isUuid(quotationId) || !isUuid(productId)) return { error: 'Product not found' }
  const draft = await assertDraft(quotationId)
  if ('error' in draft) return { error: draft.error }
  const { supabase, quote } = draft
  const { data: product } = await supabase
    .from('products')
    .select('id, name, price, moq, status')
    .eq('id', productId)
    .maybeSingle()
  if (!product || product.status !== 'active') return { error: 'That product is not available' }
  const { data: existing } = await supabase
    .from('quotation_items')
    .select('id, quantity')
    .eq('quotation_id', quotationId)
    .eq('product_id', productId)
    .maybeSingle()
  if (existing) {
    const nextQty = (Number(existing.quantity) || 0) + 1
    const { error } = await supabase.from('quotation_items').update({ quantity: nextQty }).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { data: company } = await supabase
      .from('companies')
      .select('account_type, margin_percent')
      .eq('id', quote.company_id)
      .maybeSingle()
    const surface = company?.account_type === 'business' ? 'business' : 'portal'
    const margin = company?.margin_percent == null ? await getCompanyMarginPercent(quote.company_id) : Number(company.margin_percent)
    const prices = await sellPricesForSurface([productId], surface, Number.isFinite(margin) ? margin : null)
    const unit = prices?.get(productId) ?? (Number(product.price) || 0)
    const quantity = Math.max(1, Number(product.moq) || 1)
    const { error } = await supabase.from('quotation_items').insert({
      quotation_id: quotationId,
      product_id: productId,
      description: product.name,
      quantity,
      unit_price: unit,
      line_total: quoteLineTotal(quantity, unit, Number(quote.discount_percent) || 0),
    })
    if (error) return { error: error.message }
  }
  const recalcError = await recalcQuote(supabase, quotationId)
  if (recalcError) return { error: recalcError }
  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/crm/quotations')
  return { success: true }
}

export async function setQuotationContact(quotationId: string, contactId: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) return { error: 'Not permitted to edit this quotation' }
  if (!isUuid(quotationId) || !isUuid(contactId)) return { error: 'Choose a contact' }
  const supabase = await createClient()
  const { data: quote } = await supabase.from('quotations').select('id, company_id, status').eq('id', quotationId).maybeSingle()
  if (!quote) return { error: 'Quotation not found' }
  if (quote.status === 'accepted') return { error: 'This quotation can no longer change contact' }
  const { data: contact } = await supabase.from('contacts').select('id, company_id').eq('id', contactId).maybeSingle()
  if (!contact || contact.company_id !== quote.company_id) return { error: 'That contact is not on this company' }
  const { error } = await supabase.from('quotations').update({ contact_id: contactId }).eq('id', quotationId)
  if (error) return { error: error.message }
  revalidatePath(`/crm/quotations/${quotationId}`)
  return { success: true }
}

export async function applyAllQuotationPrices(
  quotationId: string,
  lines: { itemId: string; offerId: string; cost: number; margin: number; unitPrice: number }[],
) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management', 'accounts'].includes(profile.role)) {
    return { error: 'Not permitted to cost quotations' }
  }
  if (!isUuid(quotationId)) return { error: 'Quotation not found' }
  const supabase = await createClient()
  const { data: quote } = await supabase.from('quotations').select('id, status, discount_percent').eq('id', quotationId).maybeSingle()
  if (!quote) return { error: 'Quotation not found' }
  if (quote.status !== 'draft') return { error: 'Only a draft quotation can be repriced' }
  const ready = lines.filter((line) => Number.isFinite(line.cost) && line.cost >= 0 && Number.isFinite(line.unitPrice) && line.unitPrice >= 0)
  if (!ready.length) return { error: 'Enter a cost before applying' }
  for (const line of ready) {
    if (!isUuid(line.itemId)) return { error: 'Quotation line not found' }
    if (!Number.isFinite(line.margin) || line.margin < 0) return { error: 'Enter a margin of zero or more' }
    const { data: item } = await supabase
      .from('quotation_items')
      .select('id, quantity')
      .eq('id', line.itemId)
      .eq('quotation_id', quotationId)
      .maybeSingle()
    if (!item) return { error: 'Quotation line not found' }
    const quantity = Number(item.quantity) || 1
    const { error: priceError } = await supabase
      .from('quotation_items')
      .update({
        unit_price: line.unitPrice,
        line_total: quoteLineTotal(quantity, line.unitPrice, Number(quote.discount_percent) || 0),
      })
      .eq('id', line.itemId)
    if (priceError) return { error: priceError.message }
    const { error: costError } = await supabase.from('quotation_item_costs').upsert({
      quotation_item_id: line.itemId,
      supplier_offer_id: isUuid(line.offerId) ? line.offerId : null,
      supplier_cost: line.cost,
      margin_percent: line.margin,
      updated_at: new Date().toISOString(),
    })
    if (costError) return { error: supplierSchemaHint(costError.message) }
  }
  const recalcError = await recalcQuote(supabase, quotationId)
  if (recalcError) return { error: recalcError }
  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/crm/quotations')
  const skipped = lines.length - ready.length
  return {
    success: true,
    message: skipped ? 'Applied prices. Some lines have no cost.' : 'Sell prices updated',
  }
}

export async function markQuotationSentOffline(quotationId: string) {
  return updateQuotationStatus(quotationId, 'sent')
}

export async function sendQuotationToClient(quotationId: string, recipientKey: string, idempotencyKey?: string) {
  return withIdempotency('crm.sendQuotation', idempotencyKey, () => sendQuotationToClientOnce(quotationId, recipientKey))
}

async function sendQuotationToClientOnce(quotationId: string, recipientKey: string) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (!['admin', 'sales', 'management'].includes(profile.role)) {
    return { error: 'Not permitted to change quotation status' }
  }
  if (!isUuid(quotationId)) return { error: 'Quotation not found' }
  const supabase = await createClient()
  const { data: quote } = await supabase
    .from('quotations')
    .select('id, status, quotation_number, company_id, total, valid_until, contact_id')
    .eq('id', quotationId)
    .maybeSingle()
  if (!quote) return { error: 'Quotation not found' }
  if (quote.status !== 'draft') return { error: `A ${quote.status} quotation cannot move to sent` }

  const { data: company } = await supabase
    .from('companies')
    .select('account_type, portal_slug')
    .eq('id', quote.company_id)
    .maybeSingle()
  const recipient = await resolveSendRecipient(supabase, quote.company_id, recipientKey)
  if (!recipient) return { error: 'Choose a recipient' }

  const marked = await updateQuotationStatus(quotationId, 'sent')
  if (marked && typeof marked === 'object' && 'error' in marked && marked.error) return marked

  const admin = createAdminClient()
  const link = clientQuotePath(company?.account_type, quotationId)
  if (admin) {
    const { data: users } = await admin
      .from('profiles')
      .select('id')
      .eq('company_id', quote.company_id)
      .in('role', ['client_admin', 'client_user', 'business_user'])
      .eq('is_active', true)
    for (const user of users || []) {
      await admin.from('notifications').insert({
        user_id: user.id,
        audience: 'client',
        title: 'Quotation ready',
        body: `${quote.quotation_number || 'A quotation'} is ready to review.`,
        link,
      })
    }
  }

  if (recipient.contactId && recipient.contactId !== quote.contact_id) {
    await supabase.from('quotations').update({ contact_id: recipient.contactId }).eq('id', quotationId)
  }

  const origin = await requestOrigin()
  const quoteUrl = absoluteClientQuoteUrl({
    accountType: company?.account_type,
    portalSlug: company?.portal_slug,
    quotationId,
    origin,
  })
  const sent = await sendEmail({
    to: recipient.email,
    subject: `Quotation ${quote.quotation_number || ''}`.trim(),
    html: businessQuoteSentEmailHtml({
      number: quote.quotation_number || 'Quotation',
      quoteUrl,
      total: formatSendTotal(quote.total),
      validUntil: quote.valid_until || undefined,
    }),
  })
  revalidatePath(`/crm/quotations/${quotationId}`)
  revalidatePath('/portal/quotations')
  revalidatePath('/business/quotes')
  if (sent.error) return { success: true, message: 'Sent, but email failed' }
  return { success: true }
}

function formatSendTotal(total: number | null) {
  const amount = Number(total) || 0
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount)
}

async function resolveSendRecipient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
  recipientKey: string,
) {
  const [kind, id] = recipientKey.split(':')
  if (!isUuid(id)) return null
  if (kind === 'contact') {
    const { data } = await supabase.from('contacts').select('id, email, company_id').eq('id', id).maybeSingle()
    if (!data?.email || data.company_id !== companyId) return null
    return { email: data.email, contactId: data.id }
  }
  if (kind === 'user') {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, company_id, is_active, role')
      .eq('id', id)
      .maybeSingle()
    if (!data?.email || !data.is_active || data.company_id !== companyId) return null
    if (!['client_admin', 'client_user', 'business_user'].includes(data.role)) return null
    return { email: data.email, contactId: null as string | null }
  }
  return null
}
