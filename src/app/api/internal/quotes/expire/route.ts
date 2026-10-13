import { createHash, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { resolveHost } from '@/lib/portal-host'
import { createAdminClient } from '@/lib/supabase/admin'
import { businessQuoteExpiredEmailHtml, businessQuoteExpiringEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { requestOrigin } from '@/lib/auth/request-origin'

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

  const expired = await admin.rpc('expire_business_quotations')
  if (expired.error) {
    return NextResponse.json({ error: expired.error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  const { data: companies } = await admin.from('companies').select('id').eq('account_type', 'business')
  const companyIds = (companies || []).map((row) => row.id)
  let reminders = 0
  let expiredMails = 0
  if (companyIds.length) {
    const origin = await requestOrigin()
    const soon = await admin
      .from('quotations')
      .select('id, quotation_number, contact_id, valid_until')
      .in('company_id', companyIds)
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
      .select('id, quotation_number, contact_id, valid_until')
      .in('company_id', companyIds)
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
  }

  return NextResponse.json(
    { expired: expired.data || 0, reminders, expiredMails },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

async function mailQuote(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  quote: { id: string; quotation_number: string | null; contact_id: string | null },
  origin: string,
  kind: 'expiring' | 'expired',
) {
  if (!quote.contact_id) return false
  const { data: contact } = await admin.from('contacts').select('email').eq('id', quote.contact_id).maybeSingle()
  if (!contact?.email) return false
  const quoteUrl = `${origin}/business/quotes/${quote.id}`
  const number = quote.quotation_number || 'Quotation'
  const sent = await sendEmail({
    to: contact.email,
    subject: kind === 'expiring' ? `${number} expires soon` : `${number} has expired`,
    html: kind === 'expiring'
      ? businessQuoteExpiringEmailHtml({ number, quoteUrl })
      : businessQuoteExpiredEmailHtml({ number, quoteUrl }),
  })
  return !sent.error
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
