import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { resolveHost } from '@/lib/portal-host'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessQuoteExpiredEmailHtml, businessQuoteExpiringEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { requestOrigin } from '@/lib/auth/request-origin'
import { absoluteClientQuoteUrl } from '@/lib/quotes/client-link'
import { quoteExpiryRecipientEmails } from '@/lib/quotes/expiry-recipients'
import { oneRelation } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest()
}

function authorized(request: NextRequest) {
  const secret = (process.env.CRON_SECRET || '').trim()
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  if (!match) return false
  try {
    return timingSafeEqual(sha256(match[1].trim()), sha256(secret))
  } catch {
    return false
  }
}

function dayOffset(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function run() {
  const admin = createAdminClient()
  if (!admin) return NextResponse.json({ error: 'Unavailable' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })

  const expired = await admin.rpc('expire_quotations')
  if (expired.error) {
    return NextResponse.json({ error: expired.error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  let reminders = 0
  let expiredMails = 0
  const origin = await requestOrigin()
  const quoteSelect = 'id, quotation_number, contact_id, company_id, valid_until, company:companies(account_type, portal_slug)'
  const soon = await admin
    .from('quotations')
    .select(quoteSelect)
    .in('status', ['sent', 'viewed'])
    .gte('valid_until', dayOffset(0))
    .lte('valid_until', dayOffset(3))
    .is('expiry_reminder_sent_at', null)
    .limit(50)
  for (const quote of soon.data || []) {
    const sent = await mailQuote(admin, quote, origin, 'expiring')
    if (sent) {
      await admin.from('quotations').update({ expiry_reminder_sent_at: new Date().toISOString() }).eq('id', quote.id)
      reminders += 1
    }
  }

  const gone = await admin
    .from('quotations')
    .select(quoteSelect)
    .eq('status', 'expired')
    .gte('valid_until', dayOffset(-2))
    .is('expired_notified_at', null)
    .limit(50)
  for (const quote of gone.data || []) {
    const sent = await mailQuote(admin, quote, origin, 'expired')
    if (sent) {
      await admin.from('quotations').update({ expired_notified_at: new Date().toISOString() }).eq('id', quote.id)
      expiredMails += 1
    }
  }

  return NextResponse.json(
    { expired: expired.data || 0, reminders, expiredMails },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

async function mailQuote(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  quote: {
    id: string
    quotation_number: string | null
    contact_id: string | null
    company_id: string | null
    company: { account_type: string | null; portal_slug: string | null } | { account_type: string | null; portal_slug: string | null }[] | null
  },
  origin: string,
  kind: 'expiring' | 'expired',
) {
  let contactEmail: string | null = null
  if (quote.contact_id) {
    const { data: contact } = await admin.from('contacts').select('email').eq('id', quote.contact_id).maybeSingle()
    contactEmail = contact?.email ?? null
  }
  let recipients = quoteExpiryRecipientEmails({ contactEmail })
  if (!recipients.length && quote.company_id) {
    const { data: users } = await admin
      .from('profiles')
      .select('email')
      .eq('company_id', quote.company_id)
      .eq('is_active', true)
      .in('role', ['client_admin', 'client_user', 'business_user'])
    recipients = quoteExpiryRecipientEmails({
      accountEmails: (users || []).map((user) => user.email),
    })
  }
  if (!recipients.length) return false
  const company = oneRelation(quote.company)
  const quoteUrl = absoluteClientQuoteUrl({
    accountType: company?.account_type,
    portalSlug: company?.portal_slug,
    quotationId: quote.id,
    origin,
  })
  const number = quote.quotation_number || 'Quotation'
  let sentAny = false
  for (const to of recipients) {
    const sent = await sendEmail({
      to,
      subject: kind === 'expiring' ? `${number} expires soon` : `${number} has expired`,
      html: kind === 'expiring'
        ? businessQuoteExpiringEmailHtml({ number, quoteUrl })
        : businessQuoteExpiredEmailHtml({ number, quoteUrl }),
    })
    if (sent.error) console.error('[quote-expiry]', quote.id, sent.error)
    else sentAny = true
  }
  return sentAny
}

async function handle(request: NextRequest) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const resolved = resolveHost(host)
  const allowed = domainSplitEnabled()
    ? resolved.kind === 'admin' || resolved.kind === 'dev' || resolved.kind === 'main' || resolved.kind === 'store'
    : resolved.kind !== 'tenant'
  if (!allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return run()
}

export function GET(request: NextRequest) {
  return handle(request)
}

export function POST(request: NextRequest) {
  return handle(request)
}
