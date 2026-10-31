'use server'

import { portalConfirmUrl } from '@/lib/auth/confirm-landing'
import { validateNewPassword, SERVICE_ROLE_MISSING } from '@/lib/auth/password'
import { requestOrigin } from '@/lib/auth/request-origin'
import { confirmOriginForAccount } from '@/lib/domain-routing'
import { allowRate } from '@/lib/business/rate-limit'
import { portalSignupConfirmEmailHtml } from '@/lib/email/business'
import { sendEmail } from '@/lib/email/resend'
import { portalSignupDomainRefusal } from '@/lib/portal/signup'
import { currentTenantSignupCompany, portalUserMetadata } from '@/lib/portal/signup-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export async function registerPortalUser(formData: FormData): Promise<{ error?: string; message?: string }> {
  const fullName = String(formData.get('full_name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')
  if (!fullName) return { error: 'Name is required' }
  if (!email || !email.includes('@')) return { error: 'A valid email is required' }
  const passwordError = validateNewPassword(password, confirm)
  if (passwordError) return { error: passwordError }

  const headerStore = await headers()
  const ip = (headerStore.get('x-forwarded-for') || '').split(',')[0].trim()
  const limited = await allowRate(`portal-signup:${email}`, 3600, 5)
  if (!limited.ok) return { error: limited.error }
  if (ip) {
    const ipLimit = await allowRate(`portal-signup-ip:${ip}`, 3600, 20)
    if (!ipLimit.ok) return { error: ipLimit.error }
  }

  const loaded = await currentTenantSignupCompany()
  if ('error' in loaded) return { error: loaded.error }
  if (loaded.refusal) return { error: loaded.refusal }
  const domainError = portalSignupDomainRefusal(email, loaded.company.allowed_email_domains)
  if (domainError) return { error: domainError }

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_ROLE_MISSING }

  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existing) return { error: 'An account with this email already exists. Sign in or reset your password.' }

  const linked = portalUserMetadata({
    role: 'client_user',
    companyId: loaded.company.id,
    source: 'self',
    mode: loaded.company.portal_signup_mode,
    domainAllowed: true,
    domainException: false,
    emailConfirmed: false,
  })

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    app_metadata: linked.appMetadata,
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    const message = created.error?.message || 'Could not create the account'
    if (/already|registered|exists/i.test(message)) {
      return { error: 'An account with this email already exists. Sign in or reset your password.' }
    }
    if (/portal email domain/i.test(message)) {
      return { error: domainError || 'This email domain is not allowed for this company portal.' }
    }
    return { error: message }
  }

  const userId = created.data.user.id
  const origin = confirmOriginForAccount({
    role: 'client_user',
    portalSlug: loaded.company.portal_slug,
    fallbackOrigin: await requestOrigin(),
  })
  const link = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${origin}/auth/confirm?next=/portal/awaiting` },
  })
  const properties = link.data?.properties
  const confirmHref = portalConfirmUrl(origin, {
    hashedToken: properties?.hashed_token,
    verificationType: properties?.verification_type,
    actionLink: properties?.action_link,
  })
  if (link.error || !confirmHref) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'We could not send the confirmation email. Please try again shortly.' }
  }

  const sent = await sendEmail({
    to: email,
    subject: `Confirm your ${loaded.company.name} portal account`,
    html: portalSignupConfirmEmailHtml({ companyName: loaded.company.name, actionLink: confirmHref }),
  })
  if (sent.error) {
    await admin.auth.admin.deleteUser(userId)
    return { error: 'We could not send the confirmation email. Please try again shortly.' }
  }

  return { message: `Check ${email} to confirm your account. You can sign in after that.` }
}
