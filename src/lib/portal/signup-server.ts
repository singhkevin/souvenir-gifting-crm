import 'server-only'

import { headers } from 'next/headers'
import { writeAudit } from '@/lib/audit'
import { portalSignupApprovedEmailHtml, portalSignupPendingEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { isMissingSchemaError } from '@/lib/orders/line-lifecycle-server'
import { adminOrigin, portalLoginUrl, portalUrlForSlug, readTenantFromHeaders, resolveHost, resolveTenantBySlug } from '@/lib/portal-host'
import {
  canDecidePortalSignup,
  initialPortalApproval,
  listedDomainAllowed,
  parsePortalSignupMode,
  portalDecisionPatch,
  portalSignupRefusal,
  type PortalApproval,
  type PortalSignupMode,
  type PortalSignupSource,
} from '@/lib/portal/signup'
import { isClientRole } from '@/lib/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PortalSignupCompany = {
  id: string
  name: string
  account_type: string | null
  portal_status: string | null
  trial_ends_at: string | null
  portal_signup_mode: PortalSignupMode
  allowed_email_domains: string[] | null
  portal_slug: string | null
  owner_id: string | null
}

function missingColumn(error: { code?: string | null; message?: string | null } | null | undefined) {
  return isMissingSchemaError(error)
}

export async function loadPortalSignupCompany(companyId: string): Promise<PortalSignupCompany | null | 'unavailable'> {
  const admin = createAdminClient()
  if (!admin) return 'unavailable'
  const { data, error } = await admin
    .from('companies')
    .select('id, name, account_type, portal_status, trial_ends_at, portal_signup_mode, allowed_email_domains, portal_slug, owner_id')
    .eq('id', companyId)
    .maybeSingle()
  if (error) {
    if (missingColumn(error)) return 'unavailable'
    return null
  }
  if (!data) return null
  const mode = parsePortalSignupMode(data.portal_signup_mode, 'manual')
  return {
    id: data.id,
    name: data.name,
    account_type: data.account_type ?? null,
    portal_status: data.portal_status ?? null,
    trial_ends_at: data.trial_ends_at ?? null,
    portal_signup_mode: typeof mode === 'string' ? mode : 'manual',
    allowed_email_domains: data.allowed_email_domains ?? null,
    portal_slug: data.portal_slug ?? null,
    owner_id: data.owner_id ?? null,
  }
}

/** Sign-up link for the tenant login page. Null when the company has not opened it. */
export async function tenantSignupOffer(): Promise<{ href: string; companyName: string } | null> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const resolved = resolveHost(host)
  if (resolved.kind !== 'tenant') return null
  const tenant = await resolveTenantBySlug(resolved.slug)
  if (!tenant) return null
  const company = await loadPortalSignupCompany(tenant.id)
  if (!company || company === 'unavailable') return null
  const refusal = portalSignupRefusal({
    accountType: company.account_type,
    portalStatus: company.portal_status,
    trialEndsAt: company.trial_ends_at,
    mode: company.portal_signup_mode,
  })
  if (refusal) return null
  if (!(company.allowed_email_domains || []).some((entry) => entry.trim())) return null
  return { href: '/login/signup', companyName: company.name }
}

export async function currentTenantSignupCompany(): Promise<
  { company: PortalSignupCompany; refusal: string | null } | { error: string }
> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const resolved = resolveHost(host)
  if (resolved.kind !== 'tenant') {
    return { error: 'Open sign-up from your company portal address.' }
  }
  const tenant = readTenantFromHeaders(headerStore) || await resolveTenantBySlug(resolved.slug)
  if (!tenant) return { error: 'This company portal was not found.' }
  const company = await loadPortalSignupCompany(tenant.id)
  if (company === 'unavailable') return { error: 'Portal sign-up is not available yet.' }
  if (!company) return { error: 'This company portal was not found.' }
  if (tenant.id !== company.id) return { error: 'This company portal was not found.' }
  const refusal = portalSignupRefusal({
    accountType: company.account_type,
    portalStatus: company.portal_status,
    trialEndsAt: company.trial_ends_at,
    mode: company.portal_signup_mode,
  })
  return { company, refusal }
}

export function portalUserMetadata(input: {
  role: 'client_admin' | 'client_user'
  companyId: string
  source: PortalSignupSource
  mode: PortalSignupMode
  domainAllowed: boolean
  domainException: boolean
  emailConfirmed: boolean
}) {
  const approval = initialPortalApproval({
    mode: input.mode,
    source: input.source,
    emailConfirmed: input.emailConfirmed,
    domainAllowed: input.domainAllowed && !input.domainException,
  })
  return {
    approval,
    appMetadata: {
      role: input.role,
      company_id: input.companyId,
      portal_approval: approval,
      portal_signup_source: input.source,
      portal_domain_exception: input.domainException ? 'true' : 'false',
    },
    profilePatch: {
      portal_approval: approval,
      portal_signup_source: input.source,
      portal_domain_exception: input.domainException,
    },
  }
}

/** Block portal mutations while the account is pending or rejected. Missing column keeps today's behaviour. */
export async function pendingPortalBlock(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('role, portal_approval')
    .eq('id', user.id)
    .maybeSingle()
  if (error) {
    if (missingColumn(error)) return null
    return 'Portal access could not be checked.'
  }
  if (!data || !isClientRole(data.role)) return null
  if (data.portal_approval === 'pending') return 'Awaiting approval'
  if (data.portal_approval === 'rejected') return 'This portal account was not approved.'
  return null
}

async function approverRows(admin: SupabaseClient, companyId: string) {
  const [{ data: staff }, { data: admins }] = await Promise.all([
    admin
      .from('profiles')
      .select('id, email, role, portal_approval')
      .eq('company_id', companyId)
      .eq('role', 'client_admin')
      .eq('is_active', true),
    admin
      .from('profiles')
      .select('id, email, role')
      .in('role', ['admin', 'sales'])
      .eq('is_active', true),
  ])
  const people = new Map<string, { id: string; email: string; role: string }>()
  for (const row of admins || []) {
    if (row.email) people.set(row.id, { id: row.id, email: row.email, role: row.role })
  }
  for (const row of staff || []) {
    if (!row.email) continue
    if (row.portal_approval === 'pending' || row.portal_approval === 'rejected') continue
    people.set(row.id, { id: row.id, email: row.email, role: row.role })
  }
  return [...people.values()]
}

async function insertNotification(admin: SupabaseClient, userId: string, title: string, body: string, link: string) {
  const row = { user_id: userId, title, body, link, audience: 'internal' }
  const { error } = await admin.from('notifications').insert(row)
  if (error) {
    await admin.from('notifications').insert({ user_id: userId, title, body, link })
  }
}

export async function notifyPortalSignupPending(input: {
  companyId: string
  companyName: string
  person: string
  userId: string
  portalSlug?: string | null
}) {
  const admin = createAdminClient()
  if (!admin) return
  const claimed = await admin
    .from('profiles')
    .update({ portal_signup_notified_at: new Date().toISOString() })
    .eq('id', input.userId)
    .is('portal_signup_notified_at', null)
    .eq('portal_approval', 'pending')
    .select('id')
  if (claimed.error) {
    if (missingColumn(claimed.error)) return
    return
  }
  if (!claimed.data?.length) return

  const people = (await approverRows(admin, input.companyId)).filter((person) => person.id !== input.userId)
  const title = `Portal sign-up waiting · ${input.companyName}`
  const body = `${input.person} is waiting for approval.`
  const staffUrl = `${adminOrigin(null)}/crm/companies/${input.companyId}?tab=clients`
  const portalBase = portalUrlForSlug(input.portalSlug)
  const clientUrl = portalBase ? `${portalBase}/portal/people` : staffUrl
  for (const person of people) {
    const link = person.role === 'client_admin' ? '/portal/people' : `/crm/companies/${input.companyId}?tab=clients`
    const reviewUrl = person.role === 'client_admin' ? clientUrl : staffUrl
    await insertNotification(admin, person.id, title, body, link)
    await sendEmail({
      to: person.email,
      subject: title,
      html: portalSignupPendingEmailHtml({
        companyName: input.companyName,
        person: input.person,
        reviewUrl,
      }),
    })
  }
}

export async function emailPortalSignupApproved(input: {
  email: string
  companyName: string
  portalSlug: string | null
}) {
  const portalUrl = portalLoginUrl(input.portalSlug) || '/login'
  await sendEmail({
    to: input.email,
    subject: `Your ${input.companyName} portal is open`,
    html: portalSignupApprovedEmailHtml({ companyName: input.companyName, portalUrl }),
  })
}

/** After email confirmation, auto modes approve a listed domain. Manual stays pending and notifies. */
export async function settlePortalSignup(userId: string) {
  const admin = createAdminClient()
  if (!admin) return
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, company_id, portal_approval, portal_signup_source, portal_domain_exception, portal_signup_notified_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !profile) return
  if (!isClientRole(profile.role) || !profile.company_id || !profile.email) return
  if (profile.portal_approval !== 'pending') return

  const company = await loadPortalSignupCompany(profile.company_id)
  if (!company || company === 'unavailable') return

  const { data: authUser } = await admin.auth.admin.getUserById(userId)
  const confirmed = Boolean(authUser?.user?.email_confirmed_at)
  const domainAllowed = listedDomainAllowed(profile.email, company.allowed_email_domains)
  const source = profile.portal_signup_source
  const shouldApprove = confirmed
    && source === 'self'
    && !profile.portal_domain_exception
    && initialPortalApproval({
      mode: company.portal_signup_mode,
      source: 'self',
      emailConfirmed: true,
      domainAllowed,
    }) === 'approved'

  if (shouldApprove) {
    const now = new Date().toISOString()
    const { data: updated } = await admin
      .from('profiles')
      .update({
        portal_approval: 'approved',
        portal_approved_at: now,
        portal_approved_by: null,
      })
      .eq('id', userId)
      .eq('portal_approval', 'pending')
      .select('id')
    if (updated?.length) {
      await writeAudit(admin, {
        action: 'approve',
        entity: 'profiles',
        entityId: userId,
        next: { portal_approval: 'approved', portal_signup_source: 'self', auto: true },
      })
      await emailPortalSignupApproved({
        email: profile.email,
        companyName: company.name,
        portalSlug: company.portal_slug,
      })
    }
    return
  }

  const ready = source !== 'self' || confirmed
  if (ready) {
    await notifyPortalSignupPending({
      companyId: company.id,
      companyName: company.name,
      person: profile.full_name || profile.email,
      userId,
      portalSlug: company.portal_slug,
    })
  }
}

export async function decidePortalSignups(input: {
  actorId: string
  actorRole: string
  actorCompanyId: string | null
  actorApproval: string | null | undefined
  decision: 'approved' | 'rejected'
  userIds: string[]
}) {
  const admin = createAdminClient()
  if (!admin) return { error: 'Portal approval is not available yet.' }
  const ids = [...new Set(input.userIds.filter(Boolean))]
  if (!ids.length) return { error: 'Select at least one person.' }

  const { data: targets, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, company_id, portal_approval, portal_signup_source')
    .in('id', ids)
  if (error) {
    if (missingColumn(error)) return { error: 'Apply the portal sign-up migration, then try again.' }
    return { error: error.message }
  }

  const targetsToWrite = []
  for (const target of targets || []) {
    const allowed = canDecidePortalSignup({
      actorId: input.actorId,
      actorRole: input.actorRole,
      actorCompanyId: input.actorCompanyId,
      actorApproval: input.actorApproval,
      targetId: target.id,
      targetRole: target.role,
      targetCompanyId: target.company_id,
    })
    if (!allowed.ok) return { error: allowed.error }
    if (target.portal_approval === input.decision) continue
    targetsToWrite.push(target)
  }

  let changed = 0
  const now = new Date().toISOString()
  for (const target of targetsToWrite) {
    const patch = portalDecisionPatch({ decision: input.decision, actorId: input.actorId, now })
    const { error: updateError } = await admin.from('profiles').update(patch).eq('id', target.id)
    if (updateError) return { error: updateError.message }
    await writeAudit(admin, {
      action: input.decision === 'approved' ? 'approve' : 'reject',
      entity: 'profiles',
      entityId: target.id,
      previous: { portal_approval: target.portal_approval },
      next: { ...patch, portal_signup_source: target.portal_signup_source },
      userId: input.actorId,
    })
    changed += 1
    if (input.decision === 'approved' && target.email && target.company_id) {
      const company = await loadPortalSignupCompany(target.company_id)
      if (company && company !== 'unavailable') {
        await emailPortalSignupApproved({
          email: target.email,
          companyName: company.name,
          portalSlug: company.portal_slug,
        })
      }
    }
  }
  return { success: true, changed }
}

export async function pendingPortalUserIds(companyId?: string | null) {
  const admin = createAdminClient()
  if (!admin) return []
  let query = admin
    .from('profiles')
    .select('id')
    .in('role', ['client_admin', 'client_user'])
    .eq('portal_approval', 'pending')
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  if (error || !data) return []
  return data.map((row) => row.id)
}

export async function provisionPortalLogin(input: {
  company: PortalSignupCompany
  email: string
  fullName: string
  role: 'client_admin' | 'client_user'
  source: 'staff' | 'invite'
  domainException: boolean
  password: string
  emailConfirmed: boolean
}) {
  const admin = createAdminClient()
  if (!admin) return { error: 'Portal accounts cannot be created until the service role is configured.' }
  const linked = portalUserMetadata({
    role: input.role,
    companyId: input.company.id,
    source: input.source,
    mode: input.company.portal_signup_mode,
    domainAllowed: listedDomainAllowed(input.email, input.company.allowed_email_domains),
    domainException: input.domainException,
    emailConfirmed: input.emailConfirmed,
  })
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: input.emailConfirmed,
    app_metadata: linked.appMetadata,
    user_metadata: { full_name: input.fullName },
  })
  if (created.error || !created.data.user) {
    const message = created.error?.message || 'Could not create the portal login'
    if (/portal email domain/i.test(message)) {
      return { error: 'Portal login email must use an allowed domain for this company, or record an exception.' }
    }
    if (/already|registered|exists/i.test(message)) {
      return { error: 'A user with this email already exists.' }
    }
    return { error: message }
  }
  const userId = created.data.user.id
  const profileRow = {
    id: userId,
    full_name: input.fullName,
    email: input.email,
    role: input.role,
    company_id: input.company.id,
    is_active: true,
    ...linked.profilePatch,
  }
  let { error: profileError } = await admin.from('profiles').upsert(profileRow)
  if (profileError && missingColumn(profileError)) {
    const { portal_approval, portal_signup_source, portal_domain_exception, ...legacy } = profileRow
    void portal_approval
    void portal_signup_source
    void portal_domain_exception
    const retry = await admin.from('profiles').upsert(legacy)
    profileError = retry.error
  }
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    if (/portal email domain/i.test(profileError.message)) {
      return { error: 'Portal login email must use an allowed domain for this company, or record an exception.' }
    }
    return { error: profileError.message }
  }
  if (linked.approval === 'pending') {
    await settlePortalSignup(userId)
  }
  return { userId, approval: linked.approval }
}

export type { PortalApproval }
