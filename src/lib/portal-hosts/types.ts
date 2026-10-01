export type PortalHostStatus =
  | 'queued'
  | 'parking'
  | 'verifying'
  | 'live'
  | 'unparking'
  | 'removed'
  | 'failed'
  | 'blocked'

export type PortalHostRole = 'primary' | 'redirect' | 'manual'
export type PortalHostDesired = 'parked' | 'unparked'

export type PortalHost = {
  id: string
  company_id: string | null
  slug: string
  hostname: string
  role: PortalHostRole
  desired: PortalHostDesired
  status: PortalHostStatus
  attempts: number
  next_attempt_at: string
  locked_until: string | null
  verify_deadline: string | null
  redirect_until: string | null
  unpark_after: string | null
  action_requested_at: string | null
  park_requests: number
  unpark_requests: number
  unpark_requested_at: string | null
  last_error: string | null
  last_error_code: string | null
  last_checked_at: string | null
  live_at: string | null
  notify_on_live: boolean
  notify_client_admins: boolean
  notified_live_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const PORTAL_STATUS_LABELS: Record<PortalHostStatus, string> = {
  queued: 'Queued',
  parking: 'Setting up',
  verifying: 'Checking SSL',
  live: 'Live',
  unparking: 'Removing',
  removed: 'Removed',
  failed: 'Failed',
  blocked: 'Blocked',
}

export function softParkedLimit() {
  const n = Number.parseInt(process.env.PORTAL_PARKED_SOFT_LIMIT || '250', 10)
  return Number.isFinite(n) && n > 0 ? n : 250
}

export function hardParkedLimit() {
  const n = Number.parseInt(process.env.PORTAL_PARKED_HARD_LIMIT || '290', 10)
  return Number.isFinite(n) && n > 0 ? n : 290
}

export function backoffMs(attempts: number) {
  const minutes = Math.min(2 ** Math.max(0, attempts), 60)
  const jitter = 0.8 + Math.random() * 0.4
  return Math.round(minutes * 60_000 * jitter)
}

export function companySubdomainStatusFromHost(status: PortalHostStatus): string {
  switch (status) {
    case 'queued':
      return 'pending'
    case 'parking':
      return 'provisioning'
    case 'verifying':
      return 'ssl_pending'
    case 'live':
      return 'live'
    case 'failed':
    case 'blocked':
      return 'failed'
    case 'unparking':
    case 'removed':
      return 'none'
    default:
      return 'pending'
  }
}
