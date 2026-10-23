'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { generateTemporaryPassword, validateNewPassword } from '@/lib/auth/password'
import { withIdempotency } from '@/lib/idempotency'

// 'runner' needs migration 20261023_runner_role_enum.sql; before it the database rejects the value.
const STAFF_ROLES = ['admin', 'sales', 'operations', 'accounts', 'management', 'runner']
// Accounts the Team page may edit: staff, and pending sign-ups (client role with no company).
// Client, business and gift-employee accounts belong to a company and are managed from that company.
const CLIENT_ROLES = ['client_admin', 'client_user']

const TEAM_SERVICE_ROLE_MISSING =
  'Team members cannot be added until SUPABASE_SERVICE_ROLE_KEY is configured as a server-only environment variable on the host. Never use a NEXT_PUBLIC_ name for this key.'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const }
  const { data: me } = await supabase.from('profiles').select('id, role, is_active').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin' || me.is_active === false) return { error: 'Admin only' as const }
  return { supabase, me }
}

export async function updateTeamMember(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, me } = auth

  const id = String(formData.get('id') || '')
  const role = String(formData.get('role') || '')
  const isActive = String(formData.get('is_active') || '') === 'true'
  const departmentId = String(formData.get('department_id') || '') || null
  if (!id) return { error: 'Member required' }
  if (!STAFF_ROLES.includes(role)) return { error: 'Invalid staff role' }

  const { data: target } = await supabase
    .from('profiles')
    .select('id, role, company_id, is_active, department_id')
    .eq('id', id)
    .maybeSingle()
  if (!target) return { error: 'Member not found' }
  const isStaff = STAFF_ROLES.includes(target.role)
  const isPending = CLIENT_ROLES.includes(target.role) && target.company_id == null
  if (!isStaff && !isPending) {
    // Saving here would clear company_id and turn a client, business or gift-portal user into staff.
    return { error: 'This account belongs to a company. Manage it from the company page.' }
  }
  if (id === me.id && (role !== 'admin' || !isActive)) {
    return { error: 'You cannot remove your own admin access. Ask another admin.' }
  }

  const { error } = await supabase.from('profiles').update({
    role,
    company_id: null,
    is_active: isActive,
    department_id: departmentId,
  }).eq('id', id)
  if (error) return { error: error.message }
  await writeAudit(supabase, {
    action: 'update',
    entity: 'profiles',
    entityId: id,
    previous: { role: target.role, is_active: target.is_active, department_id: target.department_id },
    next: { role, is_active: isActive, department_id: departmentId },
    userId: me.id,
  })
  revalidatePath('/crm/team')
  return { success: true }
}

export async function addTeamMember(formData: FormData) {
  return withIdempotency('crm.addTeamMember', formData, () => addTeamMemberOnce(formData))
}

// Creates a staff login directly (no invite email is sent). The temporary password is returned once
// so the admin can share it; it is never stored in application tables.
async function addTeamMemberOnce(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, me } = auth

  const fullName = String(formData.get('full_name') || '').trim()
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const role = String(formData.get('role') || '')
  const departmentId = String(formData.get('department_id') || '') || null
  let password = String(formData.get('password') || '')
  if (formData.get('generate_password') === '1' || !password) password = generateTemporaryPassword()

  if (!fullName || !email) return { error: 'Name and email are required' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email' }
  if (!STAFF_ROLES.includes(role)) return { error: 'Pick a staff role' }
  const passwordError = validateNewPassword(password)
  if (passwordError) return { error: passwordError }

  const admin = createAdminClient()
  if (!admin) return { error: TEAM_SERVICE_ROLE_MISSING }

  const { data: existing } = await admin.from('profiles').select('id, role, company_id').eq('email', email).maybeSingle()
  if (existing) {
    const pendingHint = CLIENT_ROLES.includes(existing.role) && existing.company_id == null
      ? ' It is listed under Pending accounts; pick a staff role there instead.'
      : ''
    return { error: `A user with this email already exists. A duplicate login was not created.${pendingHint}` }
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
    app_metadata: { role },
  })
  if (error || !created.user) {
    const message = error?.message || 'Could not create the login'
    if (message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')) {
      return { error: 'A user with this email already exists. A duplicate login was not created.' }
    }
    return { error: message }
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: created.user.id,
    full_name: fullName,
    email,
    role,
    company_id: null,
    department_id: departmentId,
    is_active: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: `The login was not saved: ${profileError.message}` }
  }

  await writeAudit(supabase, {
    action: 'create',
    entity: 'profiles',
    entityId: created.user.id,
    next: { email, role, department_id: departmentId },
    userId: me.id,
  })

  revalidatePath('/crm/team')
  return { success: true, email, temporaryPassword: password }
}
