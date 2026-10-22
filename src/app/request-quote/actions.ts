'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import { requestOrigin } from '@/lib/auth/request-origin'
import { shouldAttachNamedCompany } from '@/lib/business/email-domain'
import { appName } from '@/lib/brand'
import { resolveAlertOwnerId } from '@/lib/alerts/owner'
import { publicQuoteOwnerEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { withIdempotency } from '@/lib/idempotency'
import { channelColumnsMissing } from '@/lib/products/channel-visibility'
import {
  buildPublicQuoteRecord,
  parseQuoteItems,
  quoteProductIds,
  resolvePublicQuoteLines,
} from '@/lib/catalogue/public-quote'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

export async function submitPublicQuote(formData: FormData): Promise<{ error?: string; success?: boolean; productName?: string | null }> {
  if (clean(formData.get('fax'))) {
    return { success: true }
  }
  return withIdempotency('public.submitQuote', formData, () => submitPublicQuoteOnce(formData))
}

async function submitPublicQuoteOnce(formData: FormData): Promise<{ error?: string; success?: boolean; productName?: string | null }> {

  const fullName = clean(formData.get('full_name'))
  const email = clean(formData.get('email')).toLowerCase()
  const companyName = clean(formData.get('company_name'))
  const phone = clean(formData.get('phone'))
  const quantity = clean(formData.get('quantity'))
  const message = clean(formData.get('message'))
  const productId = clean(formData.get('product_id'))
  const productName = clean(formData.get('product_name'))
  const itemsRaw = clean(formData.get('items_json'))

  if (!fullName) return { error: 'Please share your name.' }
  if (!email || !email.includes('@')) return { error: 'Please share a valid work email.' }
  if (!companyName) return { error: 'Please share your company name.' }
  if (!message) return { error: 'Please tell us a little about the gifting need.' }

  const admin = createAdminClient()
  if (!admin) return { error: 'Unable to send this enquiry just now. Please try again shortly.' }

  const profile = await getProfile()
  if (profile && (profile.role === 'client_admin' || profile.role === 'client_user')) {
    // Existing clients already have a requirement flow in the portal.
    // We still record a website-sourced note on a lead so sales can see the catalogue context.
  }

  const items = parseQuoteItems(itemsRaw)
  const lookupIds = quoteProductIds({ items, productId })
  // Retail quote: products switched on for the retail store (legacy: catalogue_access = 'all').
  const storeProducts = (column: string, value: string | boolean) => admin
    .from('products')
    .select('id, name, sku')
    .in('id', lookupIds)
    .eq('status', 'active')
    .eq(column, value)
  let lookup = lookupIds.length ? await storeProducts('show_in_store', true) : null
  if (lookup?.error && channelColumnsMissing(lookup.error.message)) {
    lookup = await storeProducts('catalogue_access', 'all')
  }
  const products = lookup?.data || null
  const lines = resolvePublicQuoteLines({
    items,
    productId,
    productName,
    quantity,
    products: (products || []).map((p) => ({ id: p.id as string, name: p.name as string, sku: (p.sku as string | null) ?? null })),
  })
  const record = buildPublicQuoteRecord({ companyName, contactName: fullName, lines, quantity, message, phone })
  const notes = record.leadNotes

  const { data: owner } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  const matched = await admin
    .from('companies')
    .select('id, name, status, account_type, owner_id')
    .ilike('name', companyName)
    .limit(1)
    .maybeSingle()
  const existingCompany = matched.error && /account_type/i.test(matched.error.message)
    ? (await admin.from('companies').select('id, name, status, owner_id').ilike('name', companyName).limit(1).maybeSingle()).data
    : matched.data

  let companyId: string | undefined
  let matchNote = ''
  if (existingCompany && shouldAttachNamedCompany(existingCompany)) {
    companyId = existingCompany.id as string
  } else if (existingCompany) {
    matchNote = `Possible match: ${existingCompany.name}. Not attached.`
  }
  if (!companyId) {
    const { data: created, error: companyError } = await admin
      .from('companies')
      .insert({
        name: companyName,
        status: 'prospect',
        owner_id: owner?.id || null,
        notes: [`Created from the public ${appName()} catalogue quote form.`, matchNote].filter(Boolean).join(' '),
      })
      .select('id')
      .single()
    if (companyError || !created) {
      return { error: 'Unable to save this enquiry. Please try again.' }
    }
    companyId = created.id
  }

  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .insert({
      company_id: companyId,
      full_name: fullName,
      email,
      phone: phone || null,
      contact_type: 'primary',
      kind: 'corporate',
      notes: 'Submitted via the public catalogue.',
    })
    .select('id')
    .single()
  if (contactError || !contact) {
    return { error: 'Unable to save this enquiry. Please try again.' }
  }

  const { data: lead, error: leadError } = await admin.from('leads').insert({
    company_id: companyId,
    contact_id: contact.id,
    owner_id: owner?.id || null,
    source: 'website',
    stage: 'cold',
    notes,
  }).select('id').single()
  if (leadError || !lead) return { error: 'Unable to save this enquiry. Please try again.' }

  const attachedOwner = existingCompany && companyId === existingCompany.id ? existingCompany.owner_id : null
  const requirementOwnerId = attachedOwner || owner?.id || null

  // Same shape as business_submit_rfq: a requirement with product lines, so staff can quote it.
  let requirementId: string | null = null
  const { data: requirement, error: requirementError } = await admin
    .from('requirements')
    .insert({
      name: record.requirementName,
      company_id: companyId,
      contact_id: contact.id,
      lead_id: lead.id,
      owner_id: requirementOwnerId,
      quantity: record.requirementQuantity,
      description: record.requirementDescription,
      status: 'active',
      source: 'website',
    })
    .select('id')
    .single()
  if (requirementError || !requirement) {
    console.error('Website quote: requirement not created', requirementError?.message)
  } else {
    requirementId = requirement.id as string
    if (record.requirementProducts.length) {
      const { error: lineError } = await admin
        .from('requirement_products')
        .insert(record.requirementProducts.map((line) => ({ ...line, requirement_id: requirementId })))
      if (lineError) console.error('Website quote: requirement products not saved', lineError.message)
    }
  }

  const alertOwnerId = await resolveAlertOwnerId(admin, requirementOwnerId)
  if (alertOwnerId) {
    const alertPath = requirementId ? `/crm/requirements/${requirementId}` : `/crm/leads/${lead.id}`
    const note = {
      user_id: alertOwnerId,
      audience: 'internal',
      title: 'New website quote request',
      body: record.notificationBody,
      link: alertPath,
    }
    const inserted = await admin.from('notifications').insert(note)
    if (inserted.error) {
      await admin.from('notifications').insert({
        user_id: note.user_id,
        title: note.title,
        body: note.body,
        link: note.link,
      })
    }
    const { data: alertOwner } = await admin
      .from('profiles')
      .select('email')
      .eq('id', alertOwnerId)
      .eq('is_active', true)
      .maybeSingle()
    if (alertOwner?.email) {
      const origin = await requestOrigin()
      await sendEmail({
        to: alertOwner.email,
        subject: record.productSummary ? `New website quote request: ${record.productSummary}` : 'New website quote request',
        html: publicQuoteOwnerEmailHtml({
          company: companyName,
          leadUrl: `${origin}/crm/leads/${lead.id}`,
          requirementUrl: requirementId ? `${origin}/crm/requirements/${requirementId}` : null,
          detail: record.notificationBody,
        }),
      })
    }
  }

  return { success: true, productName: record.productSummary }
}
