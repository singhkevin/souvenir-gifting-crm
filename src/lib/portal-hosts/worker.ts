import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { writeAudit } from '@/lib/audit'
import { rootDomain } from '@/lib/portal-host'
import {
  deleteSubdomain,
  HostingerAuthError,
  HostingerRateLimited,
  HostingerRetryableError,
  HostingerValidationError,
  listParked,
  listSubdomains,
  park,
  unpark,
  type ParkedDomain,
  type SubdomainEntry,
} from '@/lib/hostinger/client'
import { notifyPortalAlert, notifyPortalLive } from '@/lib/portal-hosts/notify'
import {
  backoffMs,
  companySubdomainStatusFromHost,
  hardParkedLimit,
  softParkedLimit,
  type PortalHost,
  type PortalHostStatus,
} from '@/lib/portal-hosts/types'

const RUN_BUDGET_MS = 25_000
const MAX_HOSTINGER_CALLS = 30
const MAX_JOBS = 10
const MAX_ERRORS_BEFORE_FAILED = 8
const PARK_TIMEOUT_MS = 15 * 60_000
const UNPARK_WAIT_MS = 15 * 60_000
const MAX_PARK_REQUESTS = 4
const MAX_UNPARK_REQUESTS = 3
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$/

export type WorkerResult = {
  ok: boolean
  processed: number
  errors: number
  fatal?: boolean
  skipped?: string
  rateLimitedUntil?: string | null
  details: Record<string, unknown>
}

type HostPatch = Partial<PortalHost> & {
  status?: PortalHostStatus
  desired?: PortalHost['desired']
}

function parkedSet(list: ParkedDomain[]) {
  return new Set(list.map((row) => row.domain.toLowerCase()))
}

function subdomainSet(list: SubdomainEntry[]) {
  return new Set(list.map((row) => row.subdomain.toLowerCase()))
}

function subdomainConflictMessage(message: string) {
  return message.toLowerCase().includes('subdomain')
}

function expectedHostname(slug: string) {
  const root = rootDomain() || 'giftingstore.online'
  return `${slug.toLowerCase()}.${root}`
}

function assertValidHostname(host: PortalHost): string | null {
  const slug = String(host.slug || '').toLowerCase()
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 40) {
    return 'Invalid portal slug'
  }
  const expected = expectedHostname(slug)
  if (host.hostname.toLowerCase() !== expected) {
    return `Hostname mismatch (expected ${expected})`
  }
  return null
}

async function latestRateLimitUntil(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const { data } = await admin
    .from('portal_host_runs')
    .select('rate_limited_until')
    .not('rate_limited_until', 'is', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.rate_limited_until ? Date.parse(data.rate_limited_until) : null
}

async function updateHost(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  host: PortalHost,
  patch: HostPatch,
  auditAction: string,
) {
  const next = {
    ...patch,
    last_checked_at: new Date().toISOString(),
    locked_until: null,
  }
  const { error } = await admin.from('portal_hosts').update(next).eq('id', host.id)
  if (error) throw new Error(error.message)

  if (host.company_id && host.role === 'primary' && host.desired === 'parked' && patch.status) {
    await admin
      .from('companies')
      .update({
        subdomain_status: companySubdomainStatusFromHost(patch.status),
        subdomain_attempts: patch.attempts ?? host.attempts,
        subdomain_last_error: patch.last_error ?? null,
        subdomain_updated_at: new Date().toISOString(),
      })
      .eq('id', host.company_id)
      .eq('portal_slug', host.slug)
  }

  if (auditAction !== 'parking_wait' && auditAction !== 'unpark_wait' && auditAction !== 'noop') {
    await writeAudit(admin, {
      action: auditAction,
      entity: 'portal_hosts',
      entityId: host.id,
      previous: { status: host.status, desired: host.desired },
      next: patch,
    })
  }

  Object.assign(host, patch)
}

async function verifyHttps(hostname: string): Promise<{ ok: boolean; reason?: string }> {
  const url = `https://${hostname}/api/portal-ping?t=${Date.now()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (res.status !== 200) {
      return { ok: false, reason: `HTTP ${res.status}` }
    }
    const json = (await res.json().catch(() => null)) as {
      app?: string
      host?: string
    } | null
    if (!json || json.app !== 'souvenir-crm') {
      return { ok: false, reason: 'Unexpected app response' }
    }
    if (String(json.host || '').toLowerCase() !== hostname.toLowerCase()) {
      return { ok: false, reason: `Host mismatch (${json.host})` }
    }
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'HTTPS check failed'
    return { ok: false, reason: message }
  } finally {
    clearTimeout(timer)
  }
}

async function companyName(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  companyId: string | null,
) {
  if (!companyId) return 'Company'
  const { data } = await admin.from('companies').select('name').eq('id', companyId).maybeSingle()
  return data?.name || 'Company'
}

let capacityWarnedAt = 0

async function alertOnTransition(
  host: PortalHost,
  nextStatus: 'blocked' | 'failed',
  params: { key: string; title: string; body: string },
) {
  if (host.status === nextStatus) return
  await notifyPortalAlert({
    key: params.key,
    title: params.title,
    body: params.body,
    hostId: host.id,
    companyId: host.company_id,
  })
}

async function markVerifying(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  host: PortalHost,
  auditAction: string,
  andProbe: boolean,
) {
  const freshDeadline = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString()
  await updateHost(admin, host, {
    status: 'verifying',
    verify_deadline:
      host.status === 'verifying' && host.verify_deadline
        ? host.verify_deadline
        : freshDeadline,
    next_attempt_at: new Date().toISOString(),
    last_error: null,
    last_error_code: null,
  }, auditAction)

  if (!andProbe) return 'ok' as const

  const check = await verifyHttps(host.hostname.toLowerCase())
  if (check.ok) {
    await updateHost(admin, host, {
      status: 'live',
      live_at: new Date().toISOString(),
      last_error: null,
      last_error_code: null,
      attempts: 0,
      next_attempt_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    }, 'live')
    const name = await companyName(admin, host.company_id)
    await notifyPortalLive(host, name)
    return 'ok' as const
  }

  const attempts = host.attempts + 1
  await updateHost(admin, host, {
    status: 'verifying',
    attempts,
    last_error: check.reason || 'Waiting for HTTPS/SSL',
    last_error_code: 'verifying',
    next_attempt_at: new Date(Date.now() + backoffMs(Math.min(attempts, 5))).toISOString(),
  }, 'verify_retry')
  return 'ok' as const
}

async function requestPark(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  host: PortalHost,
  parked: Set<string>,
  counters: { hostingerCalls: number },
) {
  if (counters.hostingerCalls >= MAX_HOSTINGER_CALLS) return 'stop' as const
  counters.hostingerCalls += 1
  await park(host.hostname.toLowerCase())
  parked.add(host.hostname.toLowerCase())
  await updateHost(admin, host, {
    status: 'parking',
    action_requested_at: new Date().toISOString(),
    park_requests: (host.park_requests || 0) + 1,
    verify_deadline: null,
    next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    last_error: null,
    last_error_code: null,
  }, 'park_requested')
  return 'ok' as const
}

async function processJob(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  host: PortalHost,
  parked: Set<string>,
  subdomains: Set<string>,
  counters: { hostingerCalls: number },
): Promise<'ok' | 'error' | 'stop'> {
  const hostname = host.hostname.toLowerCase()
  const prefix = host.slug.toLowerCase()

  const invalid = assertValidHostname(host)
  if (invalid) {
    await alertOnTransition(host, 'failed', {
      key: `failed:${host.id}`,
      title: `Portal failed: ${host.slug}`,
      body: invalid,
    })
    await updateHost(admin, host, {
      status: 'failed',
      last_error: invalid,
      last_error_code: 'invalid_hostname',
      next_attempt_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    }, 'invalid_hostname')
    return 'ok'
  }

  const isParked = parked.has(hostname)

  // Unpark path
  if (host.desired === 'unparked' || host.status === 'unparking') {
    const { data: otherWanted } = await admin
      .from('portal_hosts')
      .select('id')
      .eq('hostname', hostname)
      .eq('desired', 'parked')
      .neq('status', 'removed')
      .neq('id', host.id)
      .limit(1)
    if (otherWanted?.length) {
      await updateHost(admin, host, {
        status: 'removed',
        last_error: 'Hostname kept by another portal host row',
        last_error_code: 'kept_by_other',
      }, 'skip_unpark_kept')
      return 'ok'
    }

    if (!isParked) {
      // Park POST may still be in flight — wait instead of marking removed
      const parkRequestedAt = host.action_requested_at ? Date.parse(host.action_requested_at) : NaN
      const parkAgeMs = Number.isFinite(parkRequestedAt) ? Date.now() - parkRequestedAt : Number.POSITIVE_INFINITY
      if (
        Number.isFinite(parkRequestedAt)
        && parkAgeMs < PARK_TIMEOUT_MS
        && (host.unpark_requests || 0) === 0
      ) {
        await updateHost(admin, host, {
          status: 'unparking',
          next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        }, 'unpark_wait')
        return 'ok'
      }
      await updateHost(admin, host, {
        status: 'removed',
        last_error: null,
        last_error_code: null,
        live_at: null,
      }, 'removed')
      return 'ok'
    }

    const unparkRequestedAt = host.unpark_requested_at ? Date.parse(host.unpark_requested_at) : NaN
    const unparkAgeMs = Number.isFinite(unparkRequestedAt) ? Date.now() - unparkRequestedAt : Number.POSITIVE_INFINITY
    const unparkAttempts = host.unpark_requests || 0

    // No repeat DELETE within 15 min of last unpark request
    if (Number.isFinite(unparkRequestedAt) && unparkAgeMs < UNPARK_WAIT_MS) {
      await updateHost(admin, host, {
        status: 'unparking',
        next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      }, 'unpark_wait')
      return 'ok'
    }

    if (unparkAttempts >= MAX_UNPARK_REQUESTS) {
      await alertOnTransition(host, 'failed', {
        key: `failed:${host.id}`,
        title: `Portal failed: ${host.slug}`,
        body: `${hostname} could not be unparked after ${MAX_UNPARK_REQUESTS} attempts.`,
      })
      await updateHost(admin, host, {
        status: 'failed',
        last_error: 'Unpark timed out',
        last_error_code: 'unpark_timeout',
        next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      }, 'unpark_timeout')
      return 'ok'
    }

    if (counters.hostingerCalls >= MAX_HOSTINGER_CALLS) return 'stop'
    counters.hostingerCalls += 1
    try {
      await unpark(hostname)
    } catch (err) {
      if (counters.hostingerCalls < MAX_HOSTINGER_CALLS) {
        counters.hostingerCalls += 1
        const fresh = parkedSet(await listParked())
        if (!fresh.has(hostname)) {
          parked.delete(hostname)
          await updateHost(admin, host, {
            status: 'removed',
            last_error: null,
            last_error_code: null,
            live_at: null,
          }, 'removed_after_delete_error')
          return 'ok'
        }
      }
      throw err
    }
    parked.delete(hostname)
    await updateHost(admin, host, {
      status: 'unparking',
      unpark_requested_at: new Date().toISOString(),
      unpark_requests: unparkAttempts + 1,
      next_attempt_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      last_error: null,
      last_error_code: null,
    }, 'unpark_requested')
    return 'ok'
  }

  // Park path — queued / failed(resync) / blocked
  if (host.status === 'queued' || host.status === 'blocked') {
    if (isParked) {
      return markVerifying(admin, host, 'queued_to_verifying', true)
    }

    if (subdomains.has(prefix)) {
      await alertOnTransition(host, 'blocked', {
        key: `blocked:${host.id}`,
        title: `Portal blocked: ${host.slug}`,
        body: `${hostname} exists as a regular Hostinger subdomain. Delete it in hPanel, then Re-sync.`,
      })
      await updateHost(admin, host, {
        status: 'blocked',
        last_error: 'Delete the regular subdomain in hPanel first, then Re-sync',
        last_error_code: 'subdomain_conflict',
        next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      }, 'blocked_subdomain')
      return 'ok'
    }

    if (parked.size >= hardParkedLimit()) {
      await alertOnTransition(host, 'blocked', {
        key: 'capacity_hard',
        title: 'Parked-domain hard limit reached',
        body: `Cannot park ${hostname}. Hard limit ${hardParkedLimit()} of 300 is in effect.`,
      })
      await updateHost(admin, host, {
        status: 'blocked',
        last_error: 'Parked-domain limit reached (300 per website)',
        last_error_code: 'capacity',
        next_attempt_at: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
      }, 'blocked_capacity')
      return 'ok'
    }

    if (parked.size >= softParkedLimit() && Date.now() - capacityWarnedAt > 24 * 60 * 60_000) {
      capacityWarnedAt = Date.now()
      await notifyPortalAlert({
        key: 'capacity_soft',
        title: 'Parked-domain soft limit',
        body: `Parked domains are at ${parked.size} (soft limit ${softParkedLimit()}). Clean up redirects and cancelled companies.`,
        hostId: host.id,
        companyId: host.company_id,
      })
    }

    try {
      return await requestPark(admin, host, parked, counters)
    } catch (err) {
      if (err instanceof HostingerValidationError) {
        const isSubConflict = subdomainConflictMessage(err.message) || subdomains.has(prefix)
        if (isSubConflict) {
          await alertOnTransition(host, 'blocked', {
            key: `blocked:${host.id}`,
            title: `Portal blocked: ${host.slug}`,
            body: `${hostname} exists as a regular Hostinger subdomain. Delete it in hPanel, then Re-sync.`,
          })
          await updateHost(admin, host, {
            status: 'blocked',
            last_error: 'Delete the regular subdomain in hPanel first, then Re-sync',
            last_error_code: 'subdomain_conflict',
            next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          }, 'blocked_subdomain_422')
          return 'ok'
        }

        if (counters.hostingerCalls >= MAX_HOSTINGER_CALLS) return 'stop'
        counters.hostingerCalls += 1
        const fresh = parkedSet(await listParked())
        for (const d of fresh) parked.add(d)
        if (parked.has(hostname)) {
          return markVerifying(admin, host, 'park_already_exists', true)
        }
      }
      throw err
    }
  }

  if (host.status === 'parking') {
    if (isParked) {
      return markVerifying(admin, host, 'parking_to_verifying', false)
    }

    const requestedAt = host.action_requested_at ? Date.parse(host.action_requested_at) : NaN
    const ageMs = Number.isFinite(requestedAt) ? Date.now() - requestedAt : Number.POSITIVE_INFINITY

    if (ageMs > PARK_TIMEOUT_MS) {
      if ((host.park_requests || 0) < MAX_PARK_REQUESTS) {
        try {
          return await requestPark(admin, host, parked, counters)
        } catch (err) {
          if (err instanceof HostingerValidationError) {
            const isSubConflict = subdomainConflictMessage(err.message) || subdomains.has(prefix)
            if (isSubConflict) {
              await alertOnTransition(host, 'blocked', {
                key: `blocked:${host.id}`,
                title: `Portal blocked: ${host.slug}`,
                body: `${hostname} exists as a regular Hostinger subdomain. Delete it in hPanel, then Re-sync.`,
              })
              await updateHost(admin, host, {
                status: 'blocked',
                last_error: 'Delete the regular subdomain in hPanel first, then Re-sync',
                last_error_code: 'subdomain_conflict',
                next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
              }, 'blocked_subdomain_422')
              return 'ok'
            }
            if (counters.hostingerCalls < MAX_HOSTINGER_CALLS) {
              counters.hostingerCalls += 1
              const fresh = parkedSet(await listParked())
              for (const d of fresh) parked.add(d)
              if (parked.has(hostname)) {
                return markVerifying(admin, host, 'park_already_exists', false)
              }
            }
          }
          throw err
        }
      }

      await alertOnTransition(host, 'failed', {
        key: `failed:${host.id}`,
        title: `Portal failed: ${host.slug}`,
        body: `${hostname} did not appear in the parked list after ${MAX_PARK_REQUESTS} park requests.`,
      })
      await updateHost(admin, host, {
        status: 'failed',
        last_error: 'Park timed out after 15 minutes',
        last_error_code: 'park_timeout',
        next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      }, 'park_timeout')
      return 'ok'
    }

    await updateHost(admin, host, {
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    }, 'parking_wait')
    return 'ok'
  }

  if (host.status === 'verifying') {
    const check = await verifyHttps(hostname)
    if (check.ok) {
      await updateHost(admin, host, {
        status: 'live',
        live_at: new Date().toISOString(),
        last_error: null,
        last_error_code: null,
        attempts: 0,
        next_attempt_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
      }, 'live')
      const name = await companyName(admin, host.company_id)
      await notifyPortalLive(host, name)
      return 'ok'
    }

    const deadline = host.verify_deadline ? Date.parse(host.verify_deadline) : NaN
    if (Number.isFinite(deadline) && Date.now() > deadline) {
      await alertOnTransition(host, 'failed', {
        key: `failed:${host.id}`,
        title: `Portal failed: ${host.slug}`,
        body: `${hostname} did not pass HTTPS verification within 3 hours. ${check.reason || ''}`.trim(),
      })
      await updateHost(admin, host, {
        status: 'failed',
        last_error: 'SSL/HTTPS not working after 3h',
        last_error_code: 'verify_timeout',
        attempts: host.attempts + 1,
        next_attempt_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      }, 'verify_failed')
      return 'ok'
    }

    const attempts = host.attempts + 1
    await updateHost(admin, host, {
      status: 'verifying',
      attempts,
      last_error: check.reason || 'Waiting for HTTPS/SSL',
      last_error_code: 'verifying',
      next_attempt_at: new Date(Date.now() + backoffMs(Math.min(attempts, 5))).toISOString(),
    }, 'verify_retry')
    return 'ok'
  }

  await updateHost(admin, host, { locked_until: null }, 'noop')
  return 'ok'
}

export async function runPortalHostsWorker(options?: {
  companyId?: string | null
  limit?: number
}): Promise<WorkerResult> {
  const admin = createAdminClient()
  if (!admin) {
    return { ok: false, processed: 0, errors: 1, fatal: true, skipped: 'missing_service_role', details: {} }
  }

  const started = Date.now()
  const rateUntil = await latestRateLimitUntil(admin)
  if (rateUntil && rateUntil > Date.now()) {
    return {
      ok: true,
      processed: 0,
      errors: 0,
      skipped: 'rate_limited',
      rateLimitedUntil: new Date(rateUntil).toISOString(),
      details: {},
    }
  }

  const { data: run, error: runError } = await admin
    .from('portal_host_runs')
    .insert({ kind: 'worker', details: { companyId: options?.companyId || null } })
    .select('id')
    .single()
  if (runError || !run) {
    return {
      ok: false,
      processed: 0,
      errors: 1,
      fatal: true,
      skipped: 'run_insert_failed',
      details: { error: runError?.message },
    }
  }

  let processed = 0
  let errors = 0
  let fatal = false
  let rateLimitedUntil: string | null = null
  const details: Record<string, unknown> = { jobs: [] as unknown[] }
  const counters = { hostingerCalls: 0 }

  try {
    const { data: jobs, error: claimError } = await admin.rpc('claim_portal_host_jobs', {
      p_limit: options?.limit || MAX_JOBS,
      p_lock_seconds: 120,
      p_company_id: options?.companyId || null,
    })
    if (claimError) {
      throw new Error(claimError.message)
    }

    const claimed = (jobs || []) as PortalHost[]
    if (claimed.length === 0) {
      await admin
        .from('portal_host_runs')
        .update({
          finished_at: new Date().toISOString(),
          processed: 0,
          errors: 0,
          details: { skipped: 'no_jobs' },
        })
        .eq('id', run.id)
      return { ok: true, processed: 0, errors: 0, skipped: 'no_jobs', details: { runId: run.id } }
    }

    counters.hostingerCalls += 1
    const parkedList = await listParked()
    const parked = parkedSet(parkedList)

    let subdomains = new Set<string>()
    try {
      counters.hostingerCalls += 1
      subdomains = subdomainSet(await listSubdomains())
    } catch (err) {
      if (err instanceof HostingerRateLimited || err instanceof HostingerAuthError) throw err
      // Other listSubdomains errors are best-effort for conflict detection
    }

    for (const raw of claimed) {
      if (Date.now() - started > RUN_BUDGET_MS) break
      if (counters.hostingerCalls >= MAX_HOSTINGER_CALLS) break

      try {
        const result = await processJob(admin, raw, parked, subdomains, counters)
        processed += 1
        ;(details.jobs as unknown[]).push({ id: raw.id, hostname: raw.hostname, result })
        if (result === 'stop') break
      } catch (err) {
        errors += 1
        if (err instanceof HostingerRateLimited) {
          rateLimitedUntil = new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString()
          await admin
            .from('portal_host_runs')
            .update({ rate_limited_until: rateLimitedUntil })
            .eq('id', run.id)
          break
        }
        if (err instanceof HostingerAuthError) {
          fatal = true
          await notifyPortalAlert({
            key: 'hostinger_auth',
            title: 'Hostinger API authentication failed',
            body: 'The portal provisioning worker could not authenticate. Check HOSTINGER_API_TOKEN in hPanel.',
            hostId: raw.id,
            companyId: raw.company_id,
          })
          break
        }

        const message = err instanceof Error ? err.message : 'Worker error'
        const attempts = raw.attempts + 1
        const failed = attempts >= MAX_ERRORS_BEFORE_FAILED
        if (failed) {
          await alertOnTransition(raw, 'failed', {
            key: `failed:${raw.id}`,
            title: `Portal failed: ${raw.slug}`,
            body: message,
          })
        }
        await updateHost(
          admin,
          raw,
          {
            status: failed ? 'failed' : raw.status === 'blocked' ? 'blocked' : raw.status,
            attempts,
            last_error: message,
            last_error_code: err instanceof HostingerValidationError ? 'validation' : 'error',
            next_attempt_at: new Date(Date.now() + backoffMs(attempts)).toISOString(),
            locked_until: null,
          },
          failed ? 'failed' : 'error_backoff',
        )
        ;(details.jobs as unknown[]).push({ id: raw.id, error: message })
        if (err instanceof HostingerRetryableError) {
          // continue
        }
      }
    }
  } catch (err) {
    errors += 1
    fatal = true
    details.fatal = err instanceof Error ? err.message : 'fatal'
    if (err instanceof HostingerRateLimited) {
      rateLimitedUntil = new Date(Date.now() + err.retryAfterSeconds * 1000).toISOString()
      fatal = false
    }
    if (err instanceof HostingerAuthError) {
      await notifyPortalAlert({
        key: 'hostinger_auth',
        title: 'Hostinger API authentication failed',
        body: err.message,
      })
    }
  }

  await admin
    .from('portal_host_runs')
    .update({
      finished_at: new Date().toISOString(),
      processed,
      errors,
      rate_limited_until: rateLimitedUntil,
      details: { ...details, hostingerCalls: counters.hostingerCalls },
    })
    .eq('id', run.id)

  return {
    ok: errors === 0 && !fatal,
    processed,
    errors,
    fatal,
    rateLimitedUntil,
    details: { ...details, hostingerCalls: counters.hostingerCalls, runId: run.id },
  }
}

/** Fire-and-forget after CRM save / Re-sync. Prefer in-process after(); no HTTP self-call. */
export function schedulePortalHostsWorker(companyId?: string | null) {
  const run = () =>
    runPortalHostsWorker({ companyId: companyId || null }).catch((err) => {
      console.error('[portal-hosts] worker failed', err instanceof Error ? err.message : err)
    })
  return run
}

export async function deleteConflictingSubdomain(slug: string) {
  await deleteSubdomain(slug)
}
