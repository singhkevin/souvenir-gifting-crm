import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { portalUrlForSlug } from '@/lib/portal-host'
import { writeAudit } from '@/lib/audit'

type PortalHostRow = {
  id: string
  company_id: string | null
  slug: string
  hostname: string
  notify_on_live: boolean
  notify_client_admins?: boolean
  notified_live_at: string | null
  created_by: string | null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function insertNotification(params: {
  userId: string
  title: string
  body: string
  link: string | null
  audience?: string
}) {
  const admin = createAdminClient()
  if (!admin) return
  const { error } = await admin.from('notifications').insert({
    user_id: params.userId,
    title: params.title,
    body: params.body,
    link: params.link,
    audience: params.audience || 'internal',
  })
  if (error) {
    await admin.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      link: params.link,
    })
  }
}

async function staffEmails(userIds: string[]): Promise<Array<{ id: string; email: string; full_name: string | null }>> {
  const admin = createAdminClient()
  if (!admin || userIds.length === 0) return []
  const { data } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', userIds)
    .eq('is_active', true)
  return (data || []).filter((p): p is { id: string; email: string; full_name: string | null } => Boolean(p.email))
}

async function activeAdmins(): Promise<Array<{ id: string; email: string }>> {
  const admin = createAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .eq('is_active', true)
  return (data || []).filter((p): p is { id: string; email: string } => Boolean(p.email))
}

function portalLiveHtml(url: string, companyName: string) {
  const safeName = escapeHtml(companyName)
  const safeUrl = escapeHtml(url)
  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1B2430;">
      <h1 style="font-size: 20px; margin-bottom: 8px;">Portal live</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #5C6570;">
        The portal for <strong>${safeName}</strong> is ready:
      </p>
      <p style="margin: 28px 0;">
        <a href="${safeUrl}"
           style="background:#806A50;color:#ffffff;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">
          Open portal
        </a>
      </p>
      <p style="font-size: 12px; line-height: 1.6; color: #8A929C;">${safeUrl}</p>
    </div>
  `
}

function alertHtml(title: string, body: string) {
  return `
    <div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1B2430;">
      <h1 style="font-size: 18px; margin-bottom: 8px;">${escapeHtml(title)}</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #5C6570;">${escapeHtml(body)}</p>
    </div>
  `
}

/** Notify once when a host becomes live. */
export async function notifyPortalLive(host: PortalHostRow, companyName: string) {
  if (!host.notify_on_live) return
  const admin = createAdminClient()
  if (!admin) return

  const { data: claimed } = await admin
    .from('portal_hosts')
    .update({ notified_live_at: new Date().toISOString() })
    .eq('id', host.id)
    .is('notified_live_at', null)
    .select('id')
  if (!claimed?.length) return

  const url = portalUrlForSlug(host.slug) || `https://${host.hostname}`
  const title = `Portal live: ${host.slug}`
  const body = `${companyName} is available at ${url}`

  const recipientIds = new Set<string>()
  if (host.created_by) recipientIds.add(host.created_by)

  if (host.company_id) {
    const { data: company } = await admin
      .from('companies')
      .select('owner_id')
      .eq('id', host.company_id)
      .maybeSingle()
    if (company?.owner_id) recipientIds.add(company.owner_id)

    if (host.notify_client_admins) {
      const { data: clients } = await admin
        .from('profiles')
        .select('id')
        .eq('company_id', host.company_id)
        .eq('role', 'client_admin')
        .eq('is_active', true)
      for (const row of clients || []) recipientIds.add(row.id)
    }
  }

  const people = await staffEmails([...recipientIds])
  for (const person of people) {
    await insertNotification({
      userId: person.id,
      title,
      body,
      link: `/crm/companies/${host.company_id || ''}`,
    })
    await sendEmail({
      to: person.email,
      subject: title,
      html: portalLiveHtml(url, companyName),
    })
  }

  await writeAudit(admin, {
    action: 'notify_live',
    entity: 'portal_hosts',
    entityId: host.id,
    next: { hostname: host.hostname, recipients: people.map((p) => p.id) },
  })
}

/** Alert admins for failed/blocked/capacity/auth. DB-throttled to one per key per 24h. */
export async function notifyPortalAlert(params: {
  key: string
  title: string
  body: string
  hostId?: string | null
  companyId?: string | null
}) {
  const admin = createAdminClient()
  if (!admin) return

  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  const { data: recent } = await admin
    .from('audit_logs')
    .select('id')
    .eq('action', 'alert')
    .eq('entity', 'portal_hosts')
    .gte('created_at', since)
    .filter('new_value->>key', 'eq', params.key)
    .limit(1)
  if (recent?.length) return

  const admins = await activeAdmins()
  for (const adminUser of admins) {
    await insertNotification({
      userId: adminUser.id,
      title: params.title,
      body: params.body,
      link: params.companyId ? `/crm/companies/${params.companyId}` : '/crm/companies',
    })
    await sendEmail({
      to: adminUser.email,
      subject: params.title,
      html: alertHtml(params.title, params.body),
    })
  }

  await writeAudit(admin, {
    action: 'alert',
    entity: 'portal_hosts',
    entityId: params.hostId || null,
    next: { key: params.key, title: params.title },
  })
}
