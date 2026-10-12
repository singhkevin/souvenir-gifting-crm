'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { requestOrigin } from '@/lib/auth/request-origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessQuoteSentEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { isUuid } from '@/lib/utils'
import { roundMoney } from '@/lib/pricing/resolve'
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
    await notifyBusinessQuoteSent(quotationId)
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
  const cost = Number(formData.get('supplier_cost'))
  const margin = Number(formData.get('margin_percent'))
  const unit = Number(formData.get('unit_price'))
  if (!isUuid(quotationId) || !isUuid(itemId)) return { error: 'Quotation line not found' }
  if (!Number.isFinite(cost) || cost < 0) return { error: 'Enter a supplier cost of zero or more' }
  if (!Number.isFinite(margin) || margin < 0) return { error: 'Enter a margin of zero or more' }
  if (!Number.isFinite(unit) || unit < 0) return { error: 'Enter a sell price of zero or more' }

  const supabase = await createClient()
  const { data: quote } = await supabase.from('quotations').select('id, status').eq('id', quotationId).maybeSingle()
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
  const lineTotal = roundMoney(quantity * unit)
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

async function notifyBusinessQuoteSent(quotationId: string) {
  const admin = createAdminClient()
  if (!admin) return
  const { data: quote, error } = await admin
    .from('quotations')
    .select('id, quotation_number, company_id, contact_id, revision_of')
    .eq('id', quotationId)
    .maybeSingle()
  if (error || !quote?.company_id) return

  const { data: company } = await admin.from('companies').select('name, account_type').eq('id', quote.company_id).maybeSingle()
  if (company?.account_type !== 'business') return

  if (quote.revision_of) {
    await admin
      .from('quotations')
      .update({ status: 'rejected', client_comment: `Superseded by ${quote.quotation_number}` })
      .eq('id', quote.revision_of)
      .in('status', ['sent', 'viewed', 'draft'])
  }

  const origin = await requestOrigin()
  const quoteUrl = `${origin}/business/quotes/${quotationId}`
  if (quote.contact_id) {
    const { data: contact } = await admin.from('contacts').select('email').eq('id', quote.contact_id).maybeSingle()
    if (contact?.email) {
      await sendEmail({
        to: contact.email,
        subject: `Quotation ${quote.quotation_number || ''}`.trim(),
        html: businessQuoteSentEmailHtml({ number: quote.quotation_number || 'Quotation', quoteUrl }),
      })
    }
  }

  const { data: users } = await admin
    .from('profiles')
    .select('id')
    .eq('company_id', quote.company_id)
    .eq('role', 'business_user')
    .eq('is_active', true)
  for (const user of users || []) {
    await admin.from('notifications').insert({
      user_id: user.id,
      audience: 'client',
      title: 'Quotation ready',
      body: `${quote.quotation_number || 'A quotation'} is ready to review.`,
      link: `/business/quotes/${quotationId}`,
    })
  }
}
