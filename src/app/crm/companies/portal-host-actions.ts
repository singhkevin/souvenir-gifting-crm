'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProfile } from '@/lib/auth'
import { writeAudit } from '@/lib/audit'
import { clearTenantCache, parsePortalSlug } from '@/lib/portal-host'
import { deleteConflictingSubdomain, schedulePortalHostsWorker } from '@/lib/portal-hosts/worker'

async function requirePortalEditor(adminOnly = false) {
  const profile = await getProfile()
  if (!profile) return { error: 'Not authenticated' as const }
  if (adminOnly && profile.role !== 'admin') {
    return { error: 'Only admins can do that.' as const }
  }
  if (!['admin', 'sales'].includes(profile.role)) {
    return { error: 'Not permitted' as const }
  }
  return { profile }
}

export async function resyncPortalHost(companyId: string) {
  const access = await requirePortalEditor(true)
  if ('error' in access) return { error: access.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server admin client is not configured.' }

  const { data: hosts } = await admin
    .from('portal_hosts')
    .select('id, slug, status')
    .eq('company_id', companyId)
    .eq('role', 'primary')
    .neq('status', 'removed')

  for (const host of hosts || []) {
    await admin
      .from('portal_hosts')
      .update({
        status: host.status === 'live' ? 'verifying' : 'queued',
        attempts: 0,
        park_requests: 0,
        action_requested_at: null,
        unpark_requests: 0,
        unpark_requested_at: null,
        next_attempt_at: new Date().toISOString(),
        locked_until: null,
        last_error: null,
        last_error_code: null,
        verify_deadline: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', host.id)
    clearTenantCache(host.slug)
  }

  const supabase = await createClient()
  await writeAudit(supabase, {
    action: 'resync',
    entity: 'portal_hosts',
    entityId: companyId,
    userId: access.profile.id,
  })

  after(schedulePortalHostsWorker(companyId))
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function removePortalAddress(companyId: string) {
  const access = await requirePortalEditor(true)
  if ('error' in access) return { error: access.error }

  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('companies')
    .select('portal_slug')
    .eq('id', companyId)
    .maybeSingle()

  const { error } = await supabase
    .from('companies')
    .update({ portal_slug: null })
    .eq('id', companyId)
  if (error) return { error: error.message }

  await writeAudit(supabase, {
    action: 'remove_portal_address',
    entity: 'companies',
    entityId: companyId,
    previous: { portal_slug: existing?.portal_slug },
    next: { portal_slug: null },
    userId: access.profile.id,
  })

  clearTenantCache(existing?.portal_slug || null)
  after(schedulePortalHostsWorker(companyId))
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function stopPortalRedirect(hostId: string, companyId: string) {
  const access = await requirePortalEditor(true)
  if ('error' in access) return { error: access.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server admin client is not configured.' }

  const { data: host } = await admin
    .from('portal_hosts')
    .select('id, slug, role')
    .eq('id', hostId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!host || host.role !== 'redirect') return { error: 'Redirect host not found.' }

  await admin
    .from('portal_hosts')
    .update({
      redirect_until: new Date().toISOString(),
      desired: 'unparked',
      unpark_after: new Date().toISOString(),
      status: 'unparking',
      action_requested_at: null,
      park_requests: 0,
      unpark_requests: 0,
      unpark_requested_at: null,
      next_attempt_at: new Date().toISOString(),
      locked_until: null,
    })
    .eq('id', hostId)

  const supabase = await createClient()
  await writeAudit(supabase, {
    action: 'stop_redirect',
    entity: 'portal_hosts',
    entityId: hostId,
    next: { slug: host.slug },
    userId: access.profile.id,
  })

  clearTenantCache(host.slug)
  after(schedulePortalHostsWorker(companyId))
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}

export async function deleteBlockedSubdomain(companyId: string, clientSlug: string) {
  const access = await requirePortalEditor(true)
  if ('error' in access) return { error: access.error }

  const admin = createAdminClient()
  if (!admin) return { error: 'Server admin client is not configured.' }

  const { data: host } = await admin
    .from('portal_hosts')
    .select('id, slug, status, last_error_code')
    .eq('company_id', companyId)
    .eq('status', 'blocked')
    .eq('last_error_code', 'subdomain_conflict')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!host?.slug) return { error: 'No blocked subdomain conflict found for this company.' }

  const parsed = parsePortalSlug(host.slug)
  if (parsed.error || !parsed.slug) return { error: parsed.error || 'Invalid portal address on the blocked host.' }
  if (parsed.slug !== String(clientSlug || '').trim().toLowerCase()) {
    return { error: 'Slug mismatch. Refresh the page and try again.' }
  }

  try {
    await deleteConflictingSubdomain(parsed.slug)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not delete the subdomain.' }
  }

  await admin
    .from('portal_hosts')
    .update({
      status: 'queued',
      attempts: 0,
      park_requests: 0,
      action_requested_at: null,
      unpark_requests: 0,
      unpark_requested_at: null,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      last_error_code: null,
      locked_until: null,
    })
    .eq('id', host.id)

  const supabase = await createClient()
  await writeAudit(supabase, {
    action: 'delete_conflicting_subdomain',
    entity: 'portal_hosts',
    entityId: companyId,
    next: { slug: parsed.slug },
    userId: access.profile.id,
  })

  after(schedulePortalHostsWorker(companyId))
  revalidatePath(`/crm/companies/${companyId}`)
  return { success: true }
}
