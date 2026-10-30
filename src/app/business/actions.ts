'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { confirmOriginForAccount } from '@/lib/domain-routing'
import { requestOrigin } from '@/lib/auth/request-origin'
import { validateNewPassword } from '@/lib/auth/password'
import { getProfile } from '@/lib/auth'
import { isBusinessRole } from '@/lib/roles'
import {
  classifyBusinessEmail,
  micrositeDomainConflict,
  registrationNotes,
  workEmailBlock,
  type EmailDomainRule,
} from '@/lib/business/email-domain'
import { gstinError, normaliseGstin } from '@/lib/business/gstin'
import { businessConfirmUrl } from '@/lib/auth/confirm-landing'
import {
  mapRegistrationFailure,
  REGISTER_EMAIL_TAKEN,
  REGISTER_PORTAL_EMAIL,
  REGISTER_SERVER,
} from '@/lib/business/register-errors'
import { storePublicOrigin } from '@/lib/site/store-public-origin'
import { allowRate } from '@/lib/business/rate-limit'
import { getBusinessAccess } from '@/lib/business/access'
import { requireBusiness } from '@/lib/business/session'
import { issueQuoteCheckoutLink } from '@/lib/business/tokens'
import { businessQuantityError, normaliseBreaks, targetPriceError, MAX_RFQ_LINES } from '@/lib/business/lines'
import { clientIpFrom, verifyTurnstile } from '@/lib/security/turnstile'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/resend'
import { resolveAlertOwnerId } from '@/lib/alerts/owner'
import { emailQuotationOwner } from '@/lib/quotes/notify-owner'
import {
  businessConfirmEmailHtml,
  businessRfqOwnerEmailHtml,
  businessRfqReceiptEmailHtml,
} from '@/lib/email/business'
import { withIdempotency } from '@/lib/idempotency'
import { isUuid } from '@/lib/utils'

export async function signOutToBusinessLogin(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/business/login')
}

const GENERIC_REGISTER =
  'If this work email can be registered, we sent a confirmation link. If you already have an account, sign in.'

function clean(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

async function removeRegistration(companyId: string, userId?: string) {
  const admin = createAdminClient()
  if (!admin) return
  if (userId) {
    await admin.from('profiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
  }
  await admin.from('leads').delete().eq('company_id', companyId)
  await admin.from('contacts').delete().eq('company_id', companyId)
  await admin.from('companies').delete().eq('id', companyId)
}

export async function registerBusiness(formData: FormData) {
  return withIdempotency('business.register', formData, () => registerBusinessOnce(formData))
}

async function registerBusinessOnce(formData: FormData) {
  if (clean(formData.get('fax'))) return { success: true, message: GENERIC_REGISTER }

  const headerStore = await headers()
  const ip = clientIpFrom(headerStore)
  const turnstile = await verifyTurnstile(clean(formData.get('cf-turnstile-response')), ip)
  if (!turnstile.ok) return { error: turnstile.error }

  const limited = await allowRate(`register:${ip}`, 3600, 5)
  if (!limited.ok) return { error: limited.error }

  const fullName = clean(formData.get('full_name'))
  const email = clean(formData.get('email')).toLowerCase()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')
  const phone = clean(formData.get('phone'))
  const legalName = clean(formData.get('legal_name'))
  const country = clean(formData.get('country')) || 'India'
  const state = clean(formData.get('state'))
  const city = clean(formData.get('city'))
  const website = clean(formData.get('website'))
  const gstin = normaliseGstin(clean(formData.get('gst_number')))

  if (!fullName) return { error: 'Name is required' }
  if (!email || !email.includes('@')) return { error: 'A valid work email is required' }
  const passwordError = validateNewPassword(password, confirm)
  if (passwordError) return { error: passwordError }
  if (!phone) return { error: 'Phone is required' }
  if (!legalName) return { error: 'Legal name is required' }
  if (!city) return { error: 'City is required' }
  if (country.toLowerCase() !== 'india') return { error: 'Business registration is available in India only' }
  const gstError = gstinError(gstin)
  if (gstError) return { error: gstError }

  const admin = createAdminClient()
  if (!admin) {
    console.error('[registerBusiness] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing')
    return { error: REGISTER_SERVER }
  }

  const existingProfile = await admin.from('profiles').select('id').ilike('email', email).maybeSingle()
  if (existingProfile.data?.id) return { error: REGISTER_EMAIL_TAKEN }

  const rulesQuery = await admin.from('email_domain_rules').select('domain, rule')
  const rules = rulesQuery.error ? null : (rulesQuery.data as EmailDomainRule[])
  let allowlist: string[] = []
  if (!rules) {
    const allowRows = await admin.from('email_domain_allowlist').select('domain')
    allowlist = (allowRows.data || []).map((row) => row.domain as string)
  }
  const emailBlock = workEmailBlock(email, allowlist, rules)
  if (emailBlock) return { error: emailBlock }

  const { data: corporates } = await admin
    .from('companies')
    .select('name, allowed_email_domains, account_type, status')
    .eq('status', 'active')
    .limit(500)
  const corporateRows = (corporates || []).map((row) => ({
    name: row.name as string,
    domains: row.allowed_email_domains as string[] | null,
    account_type: row.account_type as string | null,
    status: row.status as string | null,
  }))
  const portalConflict = micrositeDomainConflict(email, corporateRows)
  if (portalConflict) return { error: REGISTER_PORTAL_EMAIL }
  const flags = classifyBusinessEmail(
    email,
    corporateRows.filter((row) => (row.account_type || 'corporate') === 'corporate'),
    rules,
  )

  const { data: companyId, error: rpcError } = await admin.rpc('register_business_account', {
    p_company: {
      legal_name: legalName,
      gst_number: gstin,
      city,
      state,
      country: 'India',
      website,
      notes: registrationNotes(flags, ''),
    },
    p_contact: { full_name: fullName, email, phone },
  })
  if (rpcError || !companyId) {
    console.error('[registerBusiness]', rpcError?.message)
    return { error: mapRegistrationFailure(rpcError?.message) }
  }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    app_metadata: { role: 'business_user', company_id: companyId },
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    await removeRegistration(String(companyId))
    const message = created.error?.message.toLowerCase() || ''
    if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
      return { error: REGISTER_EMAIL_TAKEN }
    }
    console.error('[registerBusiness] createUser', created.error?.message)
    return { error: REGISTER_SERVER }
  }

  const accountOrigin = confirmOriginForAccount({
    role: 'business_user',
    portalSlug: null,
    fallbackOrigin: await requestOrigin(),
  })
  const origin = accountOrigin === storePublicOrigin(null) || accountOrigin === 'https://souvenirgifting.com'
    ? storePublicOrigin(null)
    : accountOrigin
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/confirm?next=/business/dashboard` },
  })
  const properties = link.data?.properties
  const confirmHref = businessConfirmUrl(origin, {
    hashedToken: properties?.hashed_token,
    verificationType: properties?.verification_type,
    actionLink: properties?.action_link,
  })
  if (link.error || !confirmHref) {
    console.error('[registerBusiness] generateLink', link.error?.message, origin)
    await removeRegistration(String(companyId), created.data.user.id)
    return { error: REGISTER_SERVER }
  }

  const sent = await sendEmail({
    to: email,
    subject: 'Confirm your business account',
    html: businessConfirmEmailHtml(confirmHref),
  })
  if (sent.error) {
    await removeRegistration(String(companyId), created.data.user.id)
    return { error: 'We could not send the confirmation email. Please try again shortly.' }
  }

  const { businessPendingVerificationEmail } = await import('@/lib/email/order-emails')
  await businessPendingVerificationEmail(String(companyId), legalName)

  return { success: true, message: GENERIC_REGISTER }
}

export async function submitBusinessRfq(formData: FormData) {
  return withIdempotency('business.submitRfq', formData, () => submitBusinessRfqOnce(formData))
}

async function submitBusinessRfqOnce(formData: FormData) {
  const headerStore = await headers()
  const turnstile = await verifyTurnstile(clean(formData.get('cf-turnstile-response')), clientIpFrom(headerStore))
  if (!turnstile.ok) return { error: turnstile.error }

  const { profile, company } = await requireBusiness()
  const access = await getBusinessAccess()
  if (!profile.company_id) return { error: 'Company not found' }
  if (!access.canSubmitQuote) {
    return { error: 'Awaiting approval' }
  }
  const limited = await allowRate(`rfq:${profile.company_id}`, 86400, 10)
  if (!limited.ok) return { error: limited.error }

  const requestId = clean(formData.get('client_request_id'))
  if (!isUuid(requestId)) return { error: 'This quote basket is missing a request id. Refresh and try again.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(clean(formData.get('lines_json')))
  } catch {
    return { error: 'Add at least one product to the quote.' }
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_RFQ_LINES) {
    return { error: 'Add between 1 and 50 products' }
  }

  const lines = []
  for (const row of parsed) {
    if (!row || typeof row !== 'object') return { error: 'A product in this quote is not valid' }
    const record = row as Record<string, unknown>
    const productId = String(record.productId || '')
    const quantity = Math.round(Number(record.quantity))
    const moq = Math.round(Number(record.moq) || 1)
    if (!isUuid(productId)) return { error: 'A product in this quote is no longer available' }
    const qtyError = businessQuantityError(quantity, moq)
    if (qtyError) return { error: qtyError }
    const alt = normaliseBreaks(moq, quantity, Array.isArray(record.altQuantities) ? record.altQuantities.map(Number) : [])
    const targetRaw = record.targetUnitPrice == null || record.targetUnitPrice === '' ? null : Number(record.targetUnitPrice)
    const priceError = targetPriceError(targetRaw)
    if (priceError) return { error: priceError }
    lines.push({
      product_id: productId,
      quantity,
      alt_quantities: alt,
      target_unit_price: targetRaw,
      note: String(record.note || '').slice(0, 500),
    })
  }

  const budgetRaw = clean(formData.get('budget'))
  const budget = budgetRaw ? Number(budgetRaw) : null
  if (budgetRaw && (!Number.isFinite(budget) || (budget ?? 0) < 0)) return { error: 'Budget must be zero or more' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('business_submit_rfq', {
    p_client_request_id: requestId,
    p_lines: lines,
    p_deadline: clean(formData.get('deadline')) || null,
    p_delivery_city: clean(formData.get('delivery_city')) || null,
    p_budget: budget,
    p_purpose: clean(formData.get('purpose')) || null,
    p_notes: clean(formData.get('notes')) || null,
  })
  if (error || !data) return { error: error?.message || 'Unable to submit this quote request' }

  const origin = await requestOrigin()
  const requestUrl = `${origin}/business/requests/${data}`
  if (profile.email) {
    await sendEmail({
      to: profile.email,
      subject: 'We received your quote request',
      html: businessRfqReceiptEmailHtml(requestUrl),
    })
  }
  const admin = createAdminClient()
  if (admin && company) {
    const { data: companyRow } = await admin.from('companies').select('owner_id').eq('id', company.id).maybeSingle()
    const ownerId = await resolveAlertOwnerId(admin, companyRow?.owner_id ?? null)
    if (ownerId) {
      const { data: owner } = await admin.from('profiles').select('email').eq('id', ownerId).eq('is_active', true).maybeSingle()
      if (owner?.email) {
        await sendEmail({
          to: owner.email,
          subject: 'New business quote request',
          html: businessRfqOwnerEmailHtml({ company: company.name, requirementUrl: `${origin}/crm/requirements/${data}` }),
        })
      }
    }
  }

  revalidatePath('/business/requests')
  revalidatePath('/crm/requirements')
  redirect(`/business/requests/${data}?submitted=1`)
}

export async function respondBusinessQuotation(formData: FormData) {
  return withIdempotency('business.respondQuote', formData, () => respondBusinessQuotationOnce(formData))
}

async function respondBusinessQuotationOnce(formData: FormData) {
  const limitedProfile = await getProfile()
  if (!limitedProfile || !isBusinessRole(limitedProfile.role)) return { error: 'Sign in with your business account' }
  const access = await getBusinessAccess()
  if (!access.canSubmitQuote) {
    return { error: access.state === 'pending' ? 'Awaiting approval' : 'Sign in with your business account' }
  }
  const limited = await allowRate(`respond:${limitedProfile.id}`, 3600, 30)
  if (!limited.ok) return { error: limited.error }

  const quotationId = clean(formData.get('quotation_id'))
  const action = clean(formData.get('response_action'))
  const comment = clean(formData.get('comment'))
  if (!isUuid(quotationId)) return { error: 'Quotation not found' }
  if (action !== 'accept' && action !== 'reject' && action !== 'revise') return { error: 'Choose a response' }
  if ((action === 'reject' || action === 'revise') && !comment) return { error: 'Add a short comment' }

  const itemIds = formData.getAll('item_id').map(String).filter((id) => isUuid(id))
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('business_respond_quotation', {
    p_quotation_id: quotationId,
    p_action: action,
    p_comment: comment || null,
    p_item_ids: action === 'accept' ? itemIds : null,
  })
  if (error || !data) return { error: error?.message || 'Unable to save this response' }
  const { data: currentQuote } = await supabase.from('quotations').select('status').eq('id', quotationId).maybeSingle()
  if (currentQuote?.status === 'expired') return { error: 'This quotation has expired' }

  const { company } = await requireBusiness()
  const origin = await requestOrigin()
  let checkoutUrl: string | null = null
  let pendingVerification = false
  if (action === 'accept') {
    const link = await issueQuoteCheckoutLink(quotationId, origin)
    if (link?.url) checkoutUrl = link.url
    else if (!link?.orderId) pendingVerification = company?.business_verification !== 'verified'
    const admin = createAdminClient()
    if (admin) {
      const { data: acceptedQuote } = await admin
        .from('quotations')
        .select('quotation_number, company_id')
        .eq('id', quotationId)
        .maybeSingle()
      const quoteLabel = acceptedQuote?.quotation_number || quotationId
      const quotePath = `/crm/quotations/${quotationId}`
      const description = pendingVerification
        ? `Business accepted quotation ${quoteLabel} before verification. Verify the account, then the checkout link can be issued. ${quotePath}`
        : `Business accepted quotation ${quoteLabel}. Follow up if store checkout is not completed. ${quotePath}`
      const taskRow = {
        title: 'Follow up if quote checkout is not completed',
        description,
        company_id: acceptedQuote?.company_id || company?.id || null,
        created_by: limitedProfile.id,
        due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      }
      const inserted = await admin.from('tasks').insert(taskRow)
      if (inserted.error && /company_id/i.test(inserted.error.message)) {
        const retry = await admin.from('tasks').insert({
          title: taskRow.title,
          description: taskRow.description,
          created_by: taskRow.created_by,
          due_at: taskRow.due_at,
        })
        if (retry.error) console.error('[business-accept-task]', retry.error.message)
      } else if (inserted.error) {
        console.error('[business-accept-task]', inserted.error.message)
      }
    }
  }

  await emailQuoteOwner(quotationId, origin, action, comment)
  revalidatePath(`/business/quotes/${quotationId}`)
  revalidatePath('/business/quotes')
  revalidatePath(`/crm/quotations/${quotationId}`)
  return {
    success: true,
    checkoutUrl,
    pendingVerification,
    message: checkoutUrl
      ? 'Accepted. Continue to store checkout at the quoted price.'
      : pendingVerification
        ? 'Accepted. We will verify your account before checkout.'
        : 'Response saved.',
  }
}

async function emailQuoteOwner(quotationId: string, origin: string, action: string, comment: string) {
  const admin = createAdminClient()
  if (!admin) return
  const { data: quote } = await admin
    .from('quotations')
    .select('quotation_number, company_id')
    .eq('id', quotationId)
    .maybeSingle()
  if (!quote?.company_id) return
  const { data: company } = await admin.from('companies').select('name').eq('id', quote.company_id).maybeSingle()
  const title = action === 'accept' ? 'Quotation accepted' : action === 'reject' ? 'Quotation declined' : 'Quote revision requested'
  const verb = action === 'accept' ? 'accepted' : action === 'reject' ? 'declined' : 'asked to revise'
  await emailQuotationOwner({
    quotationId,
    origin,
    title,
    detail: `${company?.name || 'A business'} ${verb} ${quote.quotation_number || 'a quotation'}. ${comment}`.trim(),
  })
}

export async function markBusinessQuotationViewed(quotationId: string) {
  if (!isUuid(quotationId)) return
  const profile = await getProfile()
  if (!profile || !isBusinessRole(profile.role)) return
  const supabase = await createClient()
  await supabase.rpc('business_mark_quotation_viewed', { p_quotation_id: quotationId })
}
