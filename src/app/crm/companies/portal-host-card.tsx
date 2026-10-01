'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/ui/status-badge'
import { PORTAL_STATUS_LABELS, type PortalHost } from '@/lib/portal-hosts/types'
import {
  deleteBlockedSubdomain,
  removePortalAddress,
  resyncPortalHost,
  stopPortalRedirect,
} from './portal-host-actions'

function formatWhen(value: string | null | undefined) {
  if (!value) return '—'
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString()
}

export function PortalHostCard({
  companyId,
  primary,
  primaryUrl,
  redirects,
  redirectUrls,
  canAdmin,
  canResync,
}: {
  companyId: string
  primary: PortalHost | null
  primaryUrl: string | null
  redirects: PortalHost[]
  redirectUrls: Record<string, string | null>
  canAdmin: boolean
  canResync: boolean
}) {
  const [pending, start] = useTransition()

  if (!primary && redirects.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 text-xs space-y-2">
        <h2 className="font-bold text-sm text-gray-900 pb-2 border-b">Portal address</h2>
        <p className="text-gray-500">No portal address set. Save a slug above to park a Hostinger alias.</p>
      </div>
    )
  }

  const label = primary ? PORTAL_STATUS_LABELS[primary.status] || primary.status : 'Removed'

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 text-xs space-y-4">
      <div className="flex items-start justify-between gap-3 pb-2 border-b">
        <div>
          <h2 className="font-bold text-sm text-gray-900">Portal address</h2>
          {primaryUrl ? (
            <p className="mt-1 font-mono text-[11px] text-gray-600 break-all">{primaryUrl}</p>
          ) : null}
        </div>
        {primary ? <StatusBadge status={label} /> : null}
      </div>

      {primary ? (
        <div className="grid gap-2 text-gray-600">
          <div><span className="font-semibold text-gray-500 w-28 inline-block">Last checked</span>{formatWhen(primary.last_checked_at)}</div>
          <div><span className="font-semibold text-gray-500 w-28 inline-block">Next retry</span>{formatWhen(primary.next_attempt_at)}</div>
          <div><span className="font-semibold text-gray-500 w-28 inline-block">Attempts</span>{primary.attempts}</div>
          {primary.last_error ? (
            <div>
              <span className="font-semibold text-gray-500 w-28 inline-block align-top">Last error</span>
              <span className="text-red-700">{primary.last_error}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {primary?.status === 'live' && primaryUrl ? (
          <a
            href={primaryUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-2 rounded-lg text-white bg-[#806A50] font-semibold"
          >
            Open portal
          </a>
        ) : null}
        {canResync && primary ? (
          <button
            type="button"
            disabled={pending}
            className="px-3 py-2 rounded-lg border font-semibold disabled:opacity-50"
            onClick={() => start(async () => {
              const result = await resyncPortalHost(companyId)
              if (result.error) toast.error(result.error)
              else toast.success('Re-sync queued')
            })}
          >
            Re-sync now
          </button>
        ) : null}
        {canAdmin && primary ? (
          <button
            type="button"
            disabled={pending}
            className="px-3 py-2 rounded-lg border border-red-200 text-red-700 font-semibold disabled:opacity-50"
            onClick={() => start(async () => {
              if (!confirm('Remove this portal address? The host will stay parked for 7 days, then be unparked.')) return
              const result = await removePortalAddress(companyId)
              if (result.error) toast.error(result.error)
              else toast.success('Portal address cleared')
            })}
          >
            Remove portal address
          </button>
        ) : null}
        {canAdmin && primary?.status === 'blocked' && primary.last_error_code === 'subdomain_conflict' ? (
          <button
            type="button"
            disabled={pending}
            className="px-3 py-2 rounded-lg border font-semibold disabled:opacity-50"
            onClick={() => start(async () => {
              if (!confirm(`Delete the regular Hostinger subdomain "${primary.slug}"? This cannot be undone from here.`)) return
              const result = await deleteBlockedSubdomain(companyId, primary.slug)
              if (result.error) toast.error(result.error)
              else toast.success('Subdomain delete requested — re-sync will continue')
            })}
          >
            Delete conflicting regular subdomain
          </button>
        ) : null}
      </div>

      {redirects.length > 0 ? (
        <div className="pt-3 border-t space-y-2">
          <p className="font-semibold text-gray-700">Old addresses</p>
          {redirects.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#FAF7F2] px-3 py-2">
              <div>
                <p className="font-mono">{redirectUrls[row.id] || row.hostname}</p>
                <p className="text-[11px] text-gray-500">
                  {row.status === 'unparking' || row.desired === 'unparked'
                    ? 'Removing…'
                    : `Redirects until ${formatWhen(row.redirect_until)}`}
                </p>
              </div>
              {canAdmin && row.role === 'redirect' && row.desired === 'parked' ? (
                <button
                  type="button"
                  disabled={pending}
                  className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold disabled:opacity-50"
                  onClick={() => start(async () => {
                    const result = await stopPortalRedirect(row.id, companyId)
                    if (result.error) toast.error(result.error)
                    else toast.success('Redirect will stop and the host will be unparked')
                  })}
                >
                  Stop redirect now
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
