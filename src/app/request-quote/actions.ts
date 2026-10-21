'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import { requestOrigin } from '@/lib/auth/request-origin'
import { isUuid } from '@/lib/utils'
import { shouldAttachNamedCompany } from '@/lib/business/email-domain'
import { appName } from '@/lib/brand'
import { resolveAlertOwnerId } from '@/lib/alerts/owner'
import { publicQuoteOwnerEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { withIdempotency } from '@/lib/idempotency'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

export async function submitPublicQuote(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  if (clean(formData.get('fax'))) {
    return { success: true }
  }
  return withIdempotency('public.submitQuote', formData, () => submitPublicQuoteOnce(formData))
}

async function submitPublicQuoteOnce(formData: FormData): Promise<{ error?: string; success?: boolean }> {

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

  let productLine = ''
  let cartItems: { id: string; name: string; quantity: number }[] = []
  if (itemsRaw) {
    try {
      const parsed = JSON.parse(itemsRaw)
      if (Array.isArray(parsed)) {
        cartItems = parsed
          .filter((row) => row && typeof row === 'object' && row.id && row.name)
          .map((row) => ({
            id: String(row.id),
            name: String(row.name),
            quantity: Math.max(1, Math.round(Number(row.quantity) || 1)),
          }))
      }
    } catch {
      cartItems = []
    }
  }

  if (cartItems.length) {
    const ids = cartItems.map((item) => item.id).filter((id) => isUuid(id))
    const { data: products } = ids.length
      ? await admin.from('products').select('id, name, sku').in('id', ids).eq('status', 'active').eq('catalogue_access', 'all')
      : { data: null }
    const bySku = new Map((products || []).map((p) => [p.id, p]))
    productLine =
      'Products:\n' +
      cartItems
        .map((item) => {
          const match = bySku.get(item.id)
          const label = match ? `${match.name} (${match.sku})` : item.name
          return `  - ${label} x ${item.quantity}`
        })
        .join('\n') +
      '\n'
  } else if (productId && isUuid(productId)) {
    const { data: product } = await admin
      .from('products')
      .select('id, name, sku')
      .eq('id', productId)
      .eq('status', 'active')
      .eq('catalogue_access', 'all')
      .maybeSingle()
    if (product) {
      productLine = `Product: ${product.name} (${product.sku})\n`
    }
  } else if (productName) {
    productLine = `Product: ${productName}\n`
  }

  const notes = [
    'Website catalogue enquiry',
    productLine.trim(),
    !cartItems.length && quantity ? `Quantity: ${quantity}` : '',
    message,
  ]
    .filter(Boolean)
    .join('\n')

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
  const alertOwnerId = await resolveAlertOwnerId(admin, attachedOwner || owner?.id || null)
  if (alertOwnerId) {
    const leadPath = `/crm/leads/${lead.id}`
    const note = {
      user_id: alertOwnerId,
      audience: 'internal',
      title: 'New website quote request',
      body: `${companyName} asked for a quote.`,
      link: leadPath,
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
        subject: 'New website quote request',
        html: publicQuoteOwnerEmailHtml({ company: companyName, leadUrl: `${origin}${leadPath}` }),
      })
    }
  }

  return { success: true }
}
