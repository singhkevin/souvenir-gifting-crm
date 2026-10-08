'use client'

import { useState, type ReactNode } from 'react'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
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
  wildcardDns = false,
}: {
  companyId: string
  primary: PortalHost | null
  primaryUrl: string | null
  redirects: PortalHost[]
  redirectUrls: Record<string, string | null>
  canAdmin: boolean
  canResync: boolean
  /** True when DNS is the Vercel wildcard, not a per-company Hostinger alias. */
  wildcardDns?: boolean
}) {
  const { pending, run } = useAction()
  const [which, setWhich] = useState<string | null>(null)
  const go = (id: string, fn: () => Promise<{ error?: string } | void>, successMessage: string) => {
    setWhich(id)
    run(fn, { successMessage })
  }
  const label_ = (id: string, text: ReactNode, pendingText: string) =>
    pending && which === id ? (
      <span className="inline-flex items-center gap-2"><Spinner />{pendingText}</span>
    ) : (
      text
    )

  if (!primary && redirects.length === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-gray-200 text-xs space-y-2">
        <h2 className="font-bold text-sm text-gray-900 pb-2 border-b">Portal address</h2>
        <p className="text-gray-500">
          {wildcardDns
            ? 'No portal address yet. Save a slug on the company. The Vercel wildcard serves it; nothing is parked per company.'
            : 'No portal address set. Save a slug above to park a Hostinger alias.'}
        </p>
      </div>
    )
  }

  const label = wildcardDns && primary
    ? 'Live'
    : primary
      ? PORTAL_STATUS_LABELS[primary.status] || primary.status
      : 'Removed'

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

      {primary && wildcardDns ? (
        <p className="text-gray-600">
          Served by the Vercel wildcard for this project. Existing slugs keep working after DNS is attached; Re-sync only updates CRM bookkeeping.
        </p>
      ) : null}

      {primary && !wildcardDns ? (
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
        {(wildcardDns || primary?.status === 'live') && primaryUrl ? (
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
            onClick={() => go('resync', () => resyncPortalHost(companyId), 'Re-sync queued')}
          >
            {label_('resync', 'Re-sync now', 'Queuing…')}
          </button>
        ) : null}
        {canAdmin && primary ? (
          <button
            type="button"
            disabled={pending}
            className="px-3 py-2 rounded-lg border border-red-200 text-red-700 font-semibold disabled:opacity-50"
            onClick={() => {
              if (!confirm(wildcardDns
                ? 'Remove this portal address? It will stop being this company\'s host. A previous address can keep redirecting until its grace period ends.'
                : 'Remove this portal address? The host will stay parked for 7 days, then be unparked.')) return
              go('remove', () => removePortalAddress(companyId), 'Portal address cleared')
            }}
          >
            {label_('remove', 'Remove portal address', 'Removing…')}
          </button>
        ) : null}
        {!wildcardDns && canAdmin && primary?.status === 'blocked' && primary.last_error_code === 'subdomain_conflict' ? (
          <button
            type="button"
            disabled={pending}
            className="px-3 py-2 rounded-lg border font-semibold disabled:opacity-50"
            onClick={() => {
              if (!confirm(`Delete the regular Hostinger subdomain "${primary.slug}"? This cannot be undone from here.`)) return
              go('delete', () => deleteBlockedSubdomain(companyId, primary.slug), 'Subdomain delete requested — re-sync will continue')
            }}
          >
            {label_('delete', 'Delete conflicting regular subdomain', 'Deleting…')}
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
                  onClick={() => go(`stop-${row.id}`, () => stopPortalRedirect(row.id, companyId), 'Redirect will stop and the host will be unparked')}
                >
                  {label_(`stop-${row.id}`, 'Stop redirect now', 'Stopping…')}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
