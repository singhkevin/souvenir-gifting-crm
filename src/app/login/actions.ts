'use server'

import { createClient } from '@/lib/supabase/server'
import { createRecoveryServerClient } from '@/lib/supabase/recovery-server'
import { redirect } from 'next/navigation'
import { isSafeNext, landingPathForRole } from '@/lib/safe-next'
import { requestOrigin, recoveryRedirectTo } from '@/lib/auth/request-origin'
import { validateNewPassword } from '@/lib/auth/password'

export async function signIn(formData: FormData): Promise<{ error?: string; redirectTo?: string } | undefined> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = formData.get('next') as string | null

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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut()
      return { error: 'This account is inactive' }
    }

    const home = landingPathForRole(profile?.role)
    if (isSafeNext(next)) {
      const isClient = profile?.role === 'client_admin' || profile?.role === 'client_user'
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
    return { redirectTo: '/portal' }
  }

  return { message: 'Check your email to confirm your account, then sign in.' }
}

export async function requestPasswordReset(formData: FormData): Promise<{ error?: string; message?: string }> {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { error: 'Enter a valid email address' }
  }

  const supabase = await createRecoveryServerClient()
  const redirectTo = await recoveryRedirectTo()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  if (error) {
    const message = error.message.toLowerCase()
    if (message.includes('redirect') || message.includes('not allowed') || (error.status ?? 0) >= 500) {
      return { error: 'Unable to send a reset email right now. Try again later.' }
    }
  }

  return {
    message: 'If an account exists for that email, a password reset link has been sent.',
  }
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
