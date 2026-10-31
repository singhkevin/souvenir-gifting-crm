'use server'

import { createClient } from '@/lib/supabase/server'
import { createRecoveryServerClient } from '@/lib/supabase/recovery-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isSafeNext, landingPathForRole } from '@/lib/safe-next'
import { requestOrigin, recoveryRedirectTo } from '@/lib/auth/request-origin'
import { validateNewPassword } from '@/lib/auth/password'
import { sendEmail, passwordResetEmailHtml } from '@/lib/email/resend'
import { isEmailAllowedForDomains } from '@/lib/pricing/domains'
import { accountKindForRole } from '@/lib/account-kind'
import { isBusinessRole, isClientRole, isGiftEmployeeRole } from '@/lib/roles'
import { businessAudienceRefusal } from '@/lib/business/access-state'
import { finderDestinations } from '@/lib/domain-routing'
import { giftEmailProblem } from '@/lib/gifts/rules'
import { domainSplitEnabled } from '@/lib/domain-flag'
import { confirmOriginForAccount, hostLoginDecision } from '@/lib/domain-routing'
import { readTenantFromHeaders, resolveHost, tenantPortalUrl, isPrimaryPortalLive } from '@/lib/portal-host'
import { headers } from 'next/headers'

export async function signIn(formData: FormData): Promise<{ error?: string; redirectTo?: string; externalPortal?: boolean; helpHref?: string; helpLabel?: string } | undefined> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = formData.get('next') as string | null
  const audience = String(formData.get('audience') || '')

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Invalid email or password' }
  }

  if (data.user) {
    let profileResult = await supabase
      .from('profiles')
      .select('role, is_active, company_id, portal_approval')
      .eq('id', data.user.id)
      .maybeSingle()
    if (profileResult.error && /portal_approval|schema cache|does not exist/i.test(profileResult.error.message)) {
      profileResult = await supabase
        .from('profiles')
        .select('role, is_active, company_id')
        .eq('id', data.user.id)
        .maybeSingle()
    }
    const profile = profileResult.data

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()
      return { error: 'This account is inactive' }
    }

    if (profile && isClientRole(profile.role) && profile.portal_approval === 'rejected') {
      await supabase.auth.signOut()
      return { error: 'This portal account was not approved.' }
    }

    const isClient = isClientRole(profile?.role)
    const isBusiness = isBusinessRole(profile?.role)
    const headerStore = await headers()
    const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
    const resolved = resolveHost(host)
    const tenant = readTenantFromHeaders(headerStore)
    let portalSlug: string | null = null

    if (profile && isClient && profile.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('allowed_email_domains, portal_slug')
        .eq('id', profile.company_id)
        .maybeSingle()
      if (company && !isEmailAllowedForDomains(email, company.allowed_email_domains)) {
        await supabase.auth.signOut()
        return { error: 'This email domain is not allowed for your company portal login.' }
      }
      portalSlug = company?.portal_slug ?? null
    }

    if (profile && isGiftEmployeeRole(profile.role)) {
      if (!profile.company_id) {
        await supabase.auth.signOut()
        return { error: 'This gift account is not linked to a company.' }
      }
      const reader = createAdminClient() ?? supabase
      const { data: giftRows, error: giftError } = await reader
        .from('gift_selections')
        .select('allowed_email_domains')
        .eq('company_id', profile.company_id)
      if (giftError) {
        await supabase.auth.signOut()
        return { error: 'Gift selection is not available yet.' }
      }
      const giftDomains = [...new Set((giftRows || []).flatMap((row) => row.allowed_email_domains || []))]
      const giftEmailError = giftEmailProblem(email, giftDomains)
      if (giftEmailError) {
        await supabase.auth.signOut()
        return { error: giftEmailError }
      }
      if (tenant && tenant.id !== profile.company_id) {
        await supabase.auth.signOut()
        return { error: 'This account cannot sign in on this portal.' }
      }
    }

    if (audience === 'business' && !isBusiness) {
      await supabase.auth.signOut()
      const refusal = businessAudienceRefusal(profile?.role)
      if (profile && (isClientRole(profile.role) || isGiftEmployeeRole(profile.role))) {
        return {
          error: refusal?.error || 'This email uses a company portal · Find your company portal',
          helpHref: finderDestinations().finder,
          helpLabel: 'Find your company portal',
        }
      }
      return { error: refusal?.error || 'Sign in with your work email' }
    }

    if (domainSplitEnabled()) {
      const decision = hostLoginDecision({
        host: resolved,
        role: profile?.role,
        companyId: profile?.company_id ?? null,
        tenantCompanyId: tenant?.id ?? null,
        portalSlug,
      })
      if (!decision.allow) {
        await supabase.auth.signOut()
        return { error: decision.message, helpHref: decision.href, helpLabel: decision.label }
      }
    }

    if (isBusiness && profile) {
      if (resolved.kind === 'tenant') {
        await supabase.auth.signOut()
        return { error: 'Business accounts sign in on the store.' }
      }
      if (profile.company_id) {
        const { data: businessCompany } = await supabase
          .from('companies')
          .select('business_verification')
          .eq('id', profile.company_id)
          .maybeSingle()
        if (businessCompany?.business_verification === 'rejected') {
          await supabase.auth.signOut()
          return { error: 'This business account was not approved.' }
        }
      }
      const home = landingPathForRole(profile.role)
      if (isSafeNext(next) && next.startsWith('/business')) return { redirectTo: next }
      return { redirectTo: home }
    }

    if (profile && isClient && profile.company_id) {
      if (resolved.kind === 'tenant') {
        if (!tenant || tenant.id !== profile.company_id) {
          await supabase.auth.signOut()
          return { error: 'This account cannot sign in on this portal.' }
        }
      } else if (portalSlug) {
        const live = await isPrimaryPortalLive(profile.company_id)
        if (live) {
          const portalUrl = tenantPortalUrl(portalSlug, host)
          if (portalUrl) return { redirectTo: portalUrl, externalPortal: true }
        }
        // Subdomain not live yet — keep the client on the apex path fallback.
        return { redirectTo: '/portal/gifts' }
      }
    }

    const home = landingPathForRole(profile?.role)
    if (isSafeNext(next)) {
      const nextIsPortal = next.startsWith('/portal')
      const nextIsCrm = next.startsWith('/crm') || next.startsWith('/dashboard') || next === '/dashboard'
      if (isClient && nextIsPortal) return { redirectTo: next }
      if (!isClient && !nextIsPortal) return { redirectTo: next }
      if (!isClient && nextIsCrm) return { redirectTo: next }
    }
    return { redirectTo: home }
  }

  return { error: 'Failed to sign in' }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signUp(formData: FormData): Promise<{ error?: string; message?: string; redirectTo?: string }> {
  const headerStore = await headers()
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
  if (resolveHost(host).kind === 'tenant') {
    return { error: 'Create your account from the sign-up page on this company portal.' }
  }
  const fullName = String(formData.get('full_name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')

  if (!fullName) return { error: 'Name is required' }
  if (!email || !email.includes('@')) return { error: 'A valid email is required' }
  const passwordError = validateNewPassword(password, confirm)
  if (passwordError) return { error: passwordError }

  const supabase = await createClient()
  const origin = await requestOrigin()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/login`,
      data: {
        full_name: fullName,
        role: 'client_user',
      },
    },
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('already') || message.includes('registered')) {
      return { error: 'An account with this email already exists. Sign in or reset your password.' }
    }
    return { error: error.message }
  }

  if (data.session) {
    if (domainSplitEnabled()) {
      const headerStore = await headers()
      const host = headerStore.get('x-forwarded-host') || headerStore.get('host')
      const resolved = resolveHost(host)
      if (resolved.kind === 'store' || resolved.kind === 'admin' || resolved.kind === 'portal-root') {
        await supabase.auth.signOut()
        return { message: 'Company portal accounts are opened by your administrator. Shop accounts sign in on the store.' }
      }
    }
    return { redirectTo: '/portal/gifts' }
  }

  return { message: 'Check your email to confirm your account, then sign in.' }
}

const GENERIC_RESET_MESSAGE = 'If an account exists for that email, a password reset link has been sent.'

async function recoveryRedirectForKnownAccount(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  email: string,
  fallback: string,
) {
  try {
    const { data: profile } = await admin
      .from('profiles')
      .select('role, company_id')
      .eq('email', email)
      .maybeSingle()
    if (!profile) return fallback
    let portalSlug: string | null = null
    if (accountKindForRole(profile.role) === 'client' && profile.company_id) {
      const { data: company } = await admin
        .from('companies')
        .select('portal_slug')
        .eq('id', profile.company_id)
        .maybeSingle()
      portalSlug = company?.portal_slug ?? null
    }
    const origin = confirmOriginForAccount({
      role: profile.role,
      portalSlug,
      fallbackOrigin: fallback.replace(/\/auth\/confirm$/, ''),
    })
    return `${origin}/auth/confirm`
  } catch {
    return fallback
  }
}

export async function requestPasswordReset(formData: FormData): Promise<{ error?: string; message?: string }> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { error: 'Enter a valid email address' }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: 'Unable to send a reset email right now. Try again later.' }
  }

  let redirectTo = await recoveryRedirectTo()
  if (domainSplitEnabled()) {
    redirectTo = await recoveryRedirectForKnownAccount(admin, email, redirectTo)
  }
  // Generate the recovery link via the admin API (no email sent by Supabase itself),
  // then deliver it ourselves through Resend instead of Supabase's built-in mailer.
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  if (error || !data?.properties?.action_link) {
    // Don't reveal whether the email is registered — same generic message either way.
    return { message: GENERIC_RESET_MESSAGE }
  }

  const { error: sendError } = await sendEmail({
    to: email,
    subject: 'Reset your password',
    html: passwordResetEmailHtml({ actionLink: data.properties.action_link }),
  })
  if (sendError) {
    console.error('[requestPasswordReset] Resend delivery failed for', email, '-', sendError)
  }

  return { message: GENERIC_RESET_MESSAGE }
}

export async function updatePassword(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')
  const passwordError = validateNewPassword(password, confirm)
  if (passwordError) return { error: passwordError }

  const supabase = await createRecoveryServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Password reset link is invalid or has expired.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  await supabase.auth.signOut({ scope: 'local' })
  return { success: true }
}
