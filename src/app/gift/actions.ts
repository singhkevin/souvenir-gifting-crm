'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { validateNewPassword, SERVICE_ROLE_MISSING } from '@/lib/auth/password'
import { getProfile } from '@/lib/auth'
import { isGiftEmployeeRole } from '@/lib/roles'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { withIdempotency } from '@/lib/idempotency'
import {
  giftChoiceProblem,
  giftEmailProblem,
  giftWindowOpen,
  normalizePhone,
  normalizePin,
} from '@/lib/gifts/rules'
import { openGiftDomains, resolveGiftCompany, signupEmailProblem } from '@/lib/gifts/company'

export async function signUpGiftEmployee(formData: FormData) {
  return withIdempotency('gift.signUp', formData, () => signUpGiftEmployeeOnce(formData))
}

async function signUpGiftEmployeeOnce(formData: FormData) {
  const fullName = String(formData.get('full_name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  const confirm = String(formData.get('confirm_password') || '')
  if (!fullName) return { error: 'Name is required' }
  const passwordError = validateNewPassword(password, confirm)
  if (passwordError) return { error: passwordError }

  const company = await resolveGiftCompany(String(formData.get('company_slug') || ''))
  if (!company) return { error: 'Open this page from your company portal.' }

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_ROLE_MISSING }

  const open = await openGiftDomains(company.id)
  const emailError = signupEmailProblem(email, open.domains)
  if (emailError) return { error: emailError }

  const { data: existing } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (existing) return { error: 'An account with this email already exists. Sign in instead.' }

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'gift_employee', company_id: company.id },
    user_metadata: { full_name: fullName },
  })
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() || ''
    if (message.includes('already') || message.includes('registered')) {
      return { error: 'An account with this email already exists. Sign in instead.' }
    }
    return { error: created.error?.message || 'Could not create the account' }
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.data.user.id,
    full_name: fullName,
    email,
    role: 'gift_employee',
    company_id: company.id,
    is_active: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.data.user.id)
    return { error: 'Gift selection is not ready yet. Ask your admin to apply the latest database migration.' }
  }

  const supabase = await createClient()
  const signed = await supabase.auth.signInWithPassword({ email, password })
  if (signed.error) return { error: 'Account created. Sign in with the same email.' }
  redirect('/gift')
}

export async function signInGiftEmployee(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { error: 'Email and password are required' }

  const supabase = await createClient()
  const signed = await supabase.auth.signInWithPassword({ email, password })
  if (signed.error) return { error: 'Invalid email or password' }

  const profile = await getProfile()
  if (!profile || !profile.is_active || !isGiftEmployeeRole(profile.role) || !profile.company_id) {
    await supabase.auth.signOut()
    return { error: 'This sign-in is only for employee gift selection.' }
  }

  const headerStore = await headers()
  const tenant = readTenantFromHeaders(headerStore)
  if (tenant && tenant.id !== profile.company_id) {
    await supabase.auth.signOut()
    return { error: 'This account cannot sign in on this portal.' }
  }

  const admin = createAdminClient()
  const reader = admin ?? supabase
  const { data, error } = await reader
    .from('gift_selections')
    .select('allowed_email_domains')
    .eq('company_id', profile.company_id)
  if (error) {
    await supabase.auth.signOut()
    return { error: 'Gift selection is not available yet.' }
  }
  const domains = [...new Set((data || []).flatMap((row) => row.allowed_email_domains || []))]
  const emailError = giftEmailProblem(profile.email || email, domains)
  if (emailError) {
    await supabase.auth.signOut()
    return { error: emailError }
  }
  redirect('/gift')
}

export async function submitGiftChoice(formData: FormData) {
  return withIdempotency('gift.submit', formData, () => submitGiftChoiceOnce(formData))
}

async function submitGiftChoiceOnce(formData: FormData) {
  const profile = await getProfile()
  if (!profile || !profile.is_active || !isGiftEmployeeRole(profile.role) || !profile.company_id) {
    return { error: 'Sign in with your company email to choose a gift.' }
  }

  const selectionId = String(formData.get('selection_id') || '')
  const itemId = String(formData.get('item_id') || '')
  const size = String(formData.get('size') || '').trim()
  const choice = {
    name: String(formData.get('employee_name') || ''),
    phone: String(formData.get('phone') || ''),
    address: String(formData.get('address') || ''),
    city: String(formData.get('city') || ''),
    state: String(formData.get('state') || ''),
    pin: String(formData.get('pin') || ''),
    size,
    sizeOptions: [] as string[],
  }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('gift_selection_submissions')
    .select('id')
    .eq('selection_id', selectionId)
    .eq('employee_user_id', profile.id)
    .maybeSingle()
  if (existing) return { error: 'This choice is locked and cannot be changed.' }

  const { data: selection } = await supabase
    .from('gift_selections')
    .select('id, company_id, allowed_email_domains, opens_at, closes_at')
    .eq('id', selectionId)
    .maybeSingle()
  if (!selection || selection.company_id !== profile.company_id) {
    return { error: 'This gift selection is not open for your company.' }
  }
  if (!giftWindowOpen(selection.opens_at, selection.closes_at)) {
    return { error: 'This gift selection is closed.' }
  }
  const emailError = giftEmailProblem(profile.email, selection.allowed_email_domains || [])
  if (emailError) return { error: emailError }

  const { data: item } = await supabase
    .from('gift_selection_items')
    .select('id, selection_id, size_options, title')
    .eq('id', itemId)
    .eq('selection_id', selectionId)
    .maybeSingle()
  if (!item) return { error: 'Choose one gift from the list.' }

  choice.sizeOptions = item.size_options || []
  const problem = giftChoiceProblem(choice)
  if (problem) return { error: problem }

  const phone = normalizePhone(choice.phone)
  const pin = normalizePin(choice.pin)
  if (!phone || !pin) return { error: giftChoiceProblem(choice) || 'Check the phone and PIN.' }

  const { error } = await supabase.from('gift_selection_submissions').insert({
    selection_id: selectionId,
    employee_user_id: profile.id,
    employee_email: profile.email,
    employee_name: choice.name.trim(),
    phone,
    address: choice.address.trim(),
    city: choice.city.trim(),
    state: choice.state.trim(),
    pin,
    item_id: item.id,
    size: (item.size_options || []).length ? size : null,
    selected_label: item.title,
  })
  if (error) {
    if (error.code === '23505' || /locked|duplicate|unique/i.test(error.message)) {
      return { error: 'This choice is locked and cannot be changed.' }
    }
    return { error: error.message }
  }
  redirect(`/gift/${selectionId}`)
}
