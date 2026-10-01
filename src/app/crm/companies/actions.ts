'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateTemporaryPassword, SERVICE_ROLE_MISSING, validateNewPassword } from '@/lib/auth/password'
import { findReusableLogo } from '@/lib/companies/identity'
import { parseAllowedEmailDomains, isEmailAllowedForDomains } from '@/lib/pricing/domains'
import { parsePortalSlug, isSlugReservedInHistory, clearTenantCache } from '@/lib/portal-host'
import { schedulePortalHostsWorker } from '@/lib/portal-hosts/worker'

const LOGO_BUCKET = 'company-logos'
const MAX_LOGO_BYTES = 2 * 1024 * 1024
// SVG is intentionally excluded: it can carry script, and these files are served
// from a public bucket. The bucket itself still permits it for other tooling.
const SALES_STATUSES = new Set(['prospect', 'active', 'inactive'])
const PORTAL_STATUSES = new Set(['trial', 'active', 'suspended', 'cancelled'])

function portalSlugError(message: string) {
  if (message.includes('PORTAL_SLUG_HELD') || message.includes('companies_portal_slug_key') || message.includes('portal_slug')) {
    return 'That portal address is already in use.'
  }
  if (message.includes('PORTAL_SLUG_COOLOFF') || message.includes('slug_history')) {
    return 'That portal address was recently used and is still reserved.'
  }
  return message
}

function kickPortalWorker(companyId: string, ...slugs: Array<string | null | undefined>) {
  for (const slug of slugs) {
    if (slug) clearTenantCache(slug)
  }
  after(schedulePortalHostsWorker(companyId))
}

async function stampPortalHostMeta(companyId: string, userId: string, notifyClientAdmins: boolean) {
  const admin = createAdminClient()
  if (!admin) return
  await admin
    .from('portal_hosts')
    .update({
      created_by: userId,
      notify_client_admins: notifyClientAdmins,
    })
    .eq('company_id', companyId)
    .eq('role', 'primary')
    .eq('desired', 'parked')
    .neq('status', 'removed')
    .is('notified_live_at', null)
}

async function assertPortalSlugAvailable(slug: string | null): Promise<string | null> {
  if (!slug) return null
  if (await isSlugReservedInHistory(slug)) {
    return 'That portal address was recently used and is still reserved.'
  }
  return null
}

function parseSalesStatus(raw: FormDataEntryValue | null, fallback: string): string | { error: string } {
  const value = String(raw || fallback).trim()
  if (!SALES_STATUSES.has(value)) {
    return { error: 'Invalid company status.' }
  }
  return value
}

function parsePortalStatus(raw: FormDataEntryValue | null, fallback: string): string | { error: string } {
  const value = String(raw || fallback).trim()
  if (!PORTAL_STATUSES.has(value)) {
    return { error: 'Invalid portal status.' }
  }
  return value
}

function parseTrialEndsAt(raw: FormDataEntryValue | null): string | null | { error: string } {
  const value = String(raw || '').trim()
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return { error: 'Trial end date is invalid.' }
  return new Date(ms).toISOString()
}

const ALLOWED_LOGO_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

async function logoPathStillUsed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  exceptCompanyId?: string,
) {
  let query = supabase.from('companies').select('id').eq('logo_path', path)
  if (exceptCompanyId) query = query.neq('id', exceptCompanyId)
  const { data } = await query.limit(1)
  return Boolean(data?.length)
}

async function copyLogoToCompany(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sourcePath: string,
  companyId: string,
) {
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).download(sourcePath)
  if (error || !data) return null
  const ext = sourcePath.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'png'
  const objectPath = `${companyId}/inherited-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(objectPath, data, {
    contentType: data.type || 'image/png',
    upsert: false,
  })
  if (uploadError) return null
  return objectPath
}

async function inheritLogoIfMissing(
  supabase: Awaited<ReturnType<typeof createClient>>,
  company: { id: string; name: string; website?: string | null; logo_path?: string | null },
) {
  if (company.logo_path) return company.logo_path
  const { data: others } = await supabase
    .from('companies')
    .select('id, name, website, logo_path')
    .not('logo_path', 'is', null)
  const match = findReusableLogo(company, others || [])
  if (!match?.company.logo_path) return null
  const copied = await copyLogoToCompany(supabase, match.company.logo_path, company.id)
  const nextPath = copied || match.company.logo_path
  const { error } = await supabase.from('companies').update({ logo_path: nextPath }).eq('id', company.id)
  if (error) return null
  return nextPath
}

async function requireCompanyEditor() {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (!['admin', 'sales'].includes(profile.role)) {
    return { error: 'Not permitted to manage companies' as const }
  }
  return { profile }
}
export async function createCompany(formData: FormData) {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const ownerId =
    access.profile.role === 'admin'
      ? ((formData.get('owner_id') as string) || user.id)
      : user.id

  const marginRaw = String(formData.get('margin_percent') || '').trim()
  const marginPercent = marginRaw === '' ? null : Number(marginRaw)
  if (marginRaw !== '' && (!Number.isFinite(marginPercent) || (marginPercent as number) < 0)) {
    return { error: 'Margin % must be a number ≥ 0' }
  }
  const allowedEmailDomains = parseAllowedEmailDomains(String(formData.get('allowed_email_domains') || ''))
  const portalSlug = parsePortalSlug(String(formData.get('portal_slug') || ''))
  if (portalSlug.error) return { error: portalSlug.error }
  const reserved = await assertPortalSlugAvailable(portalSlug.slug)
  if (reserved) return { error: reserved }
  const status = parseSalesStatus(formData.get('status'), 'active')
  if (typeof status === 'object') return status
  const portalStatus = parsePortalStatus(formData.get('portal_status'), 'active')
  if (typeof portalStatus === 'object') return portalStatus
  const trialEndsAt = parseTrialEndsAt(formData.get('trial_ends_at'))
  if (typeof trialEndsAt === 'object') return trialEndsAt

  const { data, error } = await supabase.from('companies').insert({
    name: formData.get('name') as string,
    industry: formData.get('industry') as string || null,
    website: formData.get('website') as string || null,
    city: formData.get('city') as string || null,
    state: formData.get('state') as string || null,
    country: (formData.get('country') as string) || 'India',
    address: formData.get('address') as string || null,
    notes: formData.get('notes') as string || null,
    owner_id: ownerId,
    status,
    portal_status: portalStatus,
    trial_ends_at: trialEndsAt,
    margin_percent: marginPercent,
    allowed_email_domains: allowedEmailDomains,
    portal_slug: portalSlug.slug,
  }).select('id').single()
  if (error) return { error: portalSlugError(error.message) }

  const file = formData.get('logo')
  if (file instanceof File && file.size > 0) {
    const extension = ALLOWED_LOGO_TYPES[file.type]
    if (extension && file.size <= MAX_LOGO_BYTES) {
      const objectPath = `${data.id}/${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(objectPath, file, { contentType: file.type, upsert: false })
      if (!uploadError) {
        await supabase.from('companies').update({ logo_path: objectPath }).eq('id', data.id)
      }
    }
  } else {
    await inheritLogoIfMissing(supabase, {
      id: data.id,
      name: String(formData.get('name') || ''),
      website: (formData.get('website') as string) || null,
    })
  }

  await writeAudit(supabase, {
    action: 'create',
    entity: 'companies',
    entityId: data.id,
    next: { name: formData.get('name'), owner_id: ownerId, portal_slug: portalSlug.slug },
    userId: user.id,
  })

  if (portalSlug.slug) {
    const notifyClients = String(formData.get('notify_client_admins_on_live') || '') === '1'
    await stampPortalHostMeta(data.id, user.id, notifyClients)
    kickPortalWorker(data.id, portalSlug.slug)
  }

  redirect(`/crm/companies/${data.id}`)
}
export async function updateCompany(companyId: string, formData: FormData) {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }

  const marginRaw = String(formData.get('margin_percent') || '').trim()
  const marginPercent = marginRaw === '' ? null : Number(marginRaw)
  if (marginRaw !== '' && (!Number.isFinite(marginPercent) || (marginPercent as number) < 0)) {
    return { error: 'Margin % must be a number ≥ 0' }
  }
  const allowedEmailDomains = parseAllowedEmailDomains(String(formData.get('allowed_email_domains') || ''))
  const portalSlug = parsePortalSlug(String(formData.get('portal_slug') || ''))
  if (portalSlug.error) return { error: portalSlug.error }
  const status = parseSalesStatus(formData.get('status'), 'active')
  if (typeof status === 'object') return status
  const portalStatus = parsePortalStatus(formData.get('portal_status'), 'active')
  if (typeof portalStatus === 'object') return portalStatus
  const trialEndsAt = parseTrialEndsAt(formData.get('trial_ends_at'))
  if (typeof trialEndsAt === 'object') return trialEndsAt

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('companies')
    .select('portal_slug, portal_status')
    .eq('id', companyId)
    .maybeSingle()
  if (portalSlug.slug && portalSlug.slug !== existing?.portal_slug) {
    const reserved = await assertPortalSlugAvailable(portalSlug.slug)
    if (reserved) return { error: reserved }
  }

  const { error } = await supabase.from('companies').update({
    name: formData.get('name') as string,
    industry: formData.get('industry') as string || null,
    website: formData.get('website') as string || null,
    city: formData.get('city') as string || null,
    state: formData.get('state') as string || null,
    country: formData.get('country') as string || null,
    address: formData.get('address') as string || null,
    notes: formData.get('notes') as string || null,
    gst_number: (formData.get('gst_number') as string) || null,
    status,
    portal_status: portalStatus,
    trial_ends_at: trialEndsAt,
    margin_percent: marginPercent,
    allowed_email_domains: allowedEmailDomains,
    portal_slug: portalSlug.slug,
  }).eq('id', companyId)
  if (error) return { error: portalSlugError(error.message) }

  const { data: current } = await supabase
    .from('companies')
    .select('id, name, website, logo_path')
    .eq('id', companyId)
    .maybeSingle()
  if (current && !current.logo_path) {
    await inheritLogoIfMissing(supabase, current)
  }
  await writeAudit(supabase, {
    action: 'update',
    entity: 'companies',
    entityId: companyId,
    previous: { portal_slug: existing?.portal_slug, portal_status: existing?.portal_status },
    next: { name: formData.get('name'), portal_slug: portalSlug.slug, portal_status: portalStatus },
    userId: access.profile.id,
  })

  const slugChanged = portalSlug.slug !== (existing?.portal_slug ?? null)
  const statusChanged = portalStatus !== (existing?.portal_status ?? 'active')
  if (slugChanged || statusChanged) {
    const notifyClients = String(formData.get('notify_client_admins_on_live') || '') === '1'
    if (portalSlug.slug) await stampPortalHostMeta(companyId, access.profile.id, notifyClients)
    kickPortalWorker(companyId, existing?.portal_slug, portalSlug.slug)
  }

  redirect(`/crm/companies/${companyId}`)
}

export async function uploadCompanyLogo(formData: FormData) {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }

  const companyId = String(formData.get('company_id') || '')
  const file = formData.get('logo')
  if (!companyId) return { error: 'Company is required' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a logo image to upload' }

  const extension = ALLOWED_LOGO_TYPES[file.type]
  if (!extension) return { error: 'Logo must be a PNG, JPG or WebP image' }
  if (file.size > MAX_LOGO_BYTES) return { error: 'Logo must be 2 MB or smaller' }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('logo_path')
    .eq('id', companyId)
    .maybeSingle()
  if (!company) return { error: 'Company not found' }

  const objectPath = `${companyId}/${Date.now()}.${extension}`
  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false })
  if (uploadError) return { error: uploadError.message }

  const { error: updateError } = await supabase
    .from('companies')
    .update({ logo_path: objectPath })
    .eq('id', companyId)
  if (updateError) {
    // Do not leave an orphaned object behind if the row could not be updated.
    await supabase.storage.from(LOGO_BUCKET).remove([objectPath])
    return { error: updateError.message }
  }

  if (company.logo_path && company.logo_path !== objectPath) {
    const stillUsed = await logoPathStillUsed(supabase, company.logo_path, companyId)
    if (!stillUsed) {
      await supabase.storage.from(LOGO_BUCKET).remove([company.logo_path])
    }
  }

  await writeAudit(supabase, {
    action: 'update',
    entity: 'companies',
    entityId: companyId,
    previous: { logo_path: company.logo_path },
    next: { logo_path: objectPath },
    userId: access.profile.id,
  })

  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/companies')
  return { success: true }
}

export async function removeCompanyLogo(formData: FormData) {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }

  const companyId = String(formData.get('company_id') || '')
  if (!companyId) return { error: 'Company is required' }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('logo_path')
    .eq('id', companyId)
    .maybeSingle()
  if (!company) return { error: 'Company not found' }

  const { error } = await supabase.from('companies').update({ logo_path: null }).eq('id', companyId)
  if (error) return { error: error.message }

  if (company.logo_path) {
    const stillUsed = await logoPathStillUsed(supabase, company.logo_path, companyId)
    if (!stillUsed) {
      await supabase.storage.from(LOGO_BUCKET).remove([company.logo_path])
    }
  }

  await writeAudit(supabase, {
    action: 'update',
    entity: 'companies',
    entityId: companyId,
    previous: { logo_path: company.logo_path },
    next: { logo_path: null },
    userId: access.profile.id,
  })

  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/companies')
  return { success: true }
}

export async function backfillMissingCompanyLogos() {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }

  const supabase = await createClient()
  const { data: companies } = await supabase.from('companies').select('id, name, website, logo_path')
  const missing = (companies || []).filter((company) => !company.logo_path)
  let inherited = 0
  for (const company of missing) {
    const next = await inheritLogoIfMissing(supabase, company)
    if (next) inherited += 1
  }
  revalidatePath('/crm/companies')
  return { success: true, scanned: missing.length, inherited }
}

export async function createPortalClient(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.role !== 'admin') return { error: 'Only an admin can create client logins' }

  const companyId = String(formData.get('company_id') || '')
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const fullName = String(formData.get('full_name') || '').trim()
  const role = String(formData.get('role') || 'client_user')
  let password = String(formData.get('password') || '')
  if (formData.get('generate_password') === '1' || !password) {
    password = generateTemporaryPassword()
  }

  if (!companyId || !email || !fullName) {
    return { error: 'Name, email and company are required' }
  }
  if (role !== 'client_admin' && role !== 'client_user') {
    return { error: 'Invalid portal role' }
  }
  const passwordError = validateNewPassword(password)
  if (passwordError) return { error: passwordError }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, allowed_email_domains')
    .eq('id', companyId)
    .maybeSingle()
  if (!company) return { error: 'Company not found' }

  if (!isEmailAllowedForDomains(email, company.allowed_email_domains)) {
    const domains = (company.allowed_email_domains || []).join(', ')
    return {
      error: domains
        ? `Portal login email must use an allowed domain (${domains}).`
        : 'Portal login email is not allowed for this company.',
    }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: SERVICE_ROLE_MISSING }
  }

  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, email, company_id')
    .eq('email', email)
    .maybeSingle()
  if (existingProfile) {
    return { error: 'A user with this login email already exists. A duplicate login was not created.' }
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role,
      company_id: companyId,
    },
  })
  if (error || !created.user) {
    const message = error?.message || 'Could not create the client login'
    if (message.toLowerCase().includes('already') || message.toLowerCase().includes('registered')) {
      return { error: 'A user with this login email already exists. A duplicate login was not created.' }
    }
    return { error: message }
  }

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: created.user.id,
      full_name: fullName,
      email,
      role,
      company_id: companyId,
      is_active: true,
    })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return { error: `Client login was not saved because company assignment failed: ${profileError.message}` }
  }

  await writeAudit(supabase, {
    action: 'create',
    entity: 'profiles',
    entityId: created.user.id,
    next: { email, role, company_id: companyId },
    userId: profile.id,
  })

  revalidatePath(`/crm/companies/${companyId}`)
  revalidatePath('/crm/team')
  return { success: true, email, temporaryPassword: password }
}

export async function resetPortalClientPassword(formData: FormData) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' }
  if (profile.role !== 'admin') return { error: 'Only an admin can reset client passwords' }

  const userId = String(formData.get('user_id') || '')
  const companyId = String(formData.get('company_id') || '')
  let password = String(formData.get('password') || '')
  if (formData.get('generate_password') === '1' || !password) {
    password = generateTemporaryPassword()
  }
  const passwordError = validateNewPassword(password)
  if (passwordError) return { error: passwordError }
  if (!userId) return { error: 'Client is required' }

  const admin = createAdminClient()
  if (!admin) return { error: SERVICE_ROLE_MISSING }

  const { data: client } = await admin
    .from('profiles')
    .select('id, email, role, company_id, is_active')
    .eq('id', userId)
    .maybeSingle()
  if (!client) return { error: 'Client not found' }
  if (companyId && client.company_id !== companyId) return { error: 'Client does not belong to this company' }
  if (client.role !== 'client_admin' && client.role !== 'client_user') {
    return { error: 'Only portal client passwords can be reset here' }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) return { error: error.message }

  const supabase = await createClient()
  await writeAudit(supabase, {
    action: 'update',
    entity: 'profiles',
    entityId: userId,
    next: { password_reset: true },
    userId: profile.id,
  })

  revalidatePath(`/crm/companies/${client.company_id}`)
  return {
    success: true,
    email: client.email,
    temporaryPassword: password,
  }
}

export async function removeCompany(formData: FormData) {
  const access = await requireCompanyEditor()
  if ('error' in access) return { error: access.error }
  if (access.profile.role !== 'admin') {
    return { error: 'Only an admin can remove a company' }
  }

  const companyId = String(formData.get('company_id') || '')
  if (!companyId) return { error: 'Company is required' }

  const supabase = await createClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, logo_path, status')
    .eq('id', companyId)
    .maybeSingle()
  if (!company) return { error: 'Company not found' }

  const [
    { count: orderCount },
    { count: invoiceCount },
    { count: quotationCount },
    { count: requirementCount },
    { count: leadCount },
    { count: campaignCount },
    { count: clientCount },
    { count: contactCount },
    { count: reviewCount },
  ] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('role', ['client_admin', 'client_user']),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
  ])

  const hasHistory = Boolean(
    orderCount || invoiceCount || quotationCount || requirementCount || leadCount || campaignCount || clientCount || contactCount || reviewCount,
  )

  if (hasHistory) {
    const { error } = await supabase.from('companies').update({ status: 'inactive' }).eq('id', companyId)
    if (error) return { error: error.message }
    await writeAudit(supabase, {
      action: 'update',
      entity: 'companies',
      entityId: companyId,
      previous: { status: company.status },
      next: { status: 'inactive', archived: true },
      userId: access.profile.id,
    })
    revalidatePath('/crm/companies')
    revalidatePath(`/crm/companies/${companyId}`)
    redirect(`/crm/companies/${companyId}?removed=archived`)
  }

  if (company.logo_path) {
    const stillUsed = await logoPathStillUsed(supabase, company.logo_path, companyId)
    if (!stillUsed) {
      await supabase.storage.from(LOGO_BUCKET).remove([company.logo_path])
    }
  }

  const { error } = await supabase.from('companies').delete().eq('id', companyId)
  if (error) {
    await supabase.from('companies').update({ status: 'inactive' }).eq('id', companyId)
    revalidatePath('/crm/companies')
    return {
      error: 'This company cannot be permanently deleted because related records still exist. It was archived instead.',
    }
  }

  await writeAudit(supabase, {
    action: 'delete',
    entity: 'companies',
    entityId: companyId,
    previous: { name: company.name },
    userId: access.profile.id,
  })
  revalidatePath('/crm/companies')
  redirect('/crm/companies?removed=deleted')
}
