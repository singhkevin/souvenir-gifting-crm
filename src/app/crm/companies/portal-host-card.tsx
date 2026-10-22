'use client'

import { useState, type ReactNode } from 'react'
import { useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
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

function portalHostStatusChip(statusText: string) {
  const lower = statusText.toLowerCase()
  if (lower === 'live' || lower === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
        {statusText}
      </span>
    )
  }
  if (lower === 'verifying' || lower === 'parking' || lower === 'queued') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
        {statusText}
      </span>
    )
  }
  if (lower === 'failed' || lower === 'blocked') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40 rounded-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
        {statusText}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] border border-[#CCC5BD] text-[#4A4640] bg-[#F6F3EC] rounded-none">
      <span className="w-1.5 h-1.5 rounded-full bg-[#7C766F]" />
      {statusText}
    </span>
  )
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
      <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
        <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD]">
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">Portal address</h2>
        </div>
        <div className="p-4 text-xs text-[#4A4640]">
          {wildcardDns
            ? 'No portal address yet. Save a slug on the company. The Vercel wildcard serves it; nothing is parked per company.'
            : 'No portal address set. Save a slug above to park a Hostinger alias.'}
        </div>
      </div>
    )
  }

  const label = wildcardDns && primary
    ? 'Live'
    : primary
      ? PORTAL_STATUS_LABELS[primary.status] || primary.status
      : 'Removed'

  return (
    <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
      <div className="bg-[#F6F3EC] px-4 py-3 border-b border-[#CCC5BD] flex items-center justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1B1A]">Portal address</h2>
          {primaryUrl ? (
            <p className="mt-0.5 font-mono text-[11px] text-[#9E4300] break-all">{primaryUrl}</p>
          ) : null}
        </div>
        {primary ? portalHostStatusChip(label) : null}
      </div>

      <div className="p-4 space-y-4 text-xs">
        {primary && wildcardDns ? (
          <p className="text-[#4A4640]">
            Served by the Vercel wildcard for this project. Existing slugs keep working after DNS is attached; Re-sync only updates CRM bookkeeping.
          </p>
        ) : null}

        {primary && !wildcardDns ? (
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Last checked</span>
              <span className="mt-0.5 block font-mono text-[#1C1B1A]">{formatWhen(primary.last_checked_at)}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Next retry</span>
              <span className="mt-0.5 block font-mono text-[#1C1B1A]">{formatWhen(primary.next_attempt_at)}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Attempts</span>
              <span className="mt-0.5 block font-mono text-[#1C1B1A]">{primary.attempts}</span>
            </div>
            {primary.last_error ? (
              <div className="sm:col-span-2">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Last error</span>
                <span className="mt-0.5 block font-mono text-[#BA1A1A]">{primary.last_error}</span>
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
              className="px-3.5 py-2 rounded-none bg-[#1C1B1A] text-[#FCF9F2] hover:bg-[#9E4300] font-bold text-xs uppercase tracking-[0.08em] transition-colors shadow-none"
            >
              Open portal
            </a>
          ) : null}
          {canResync && primary ? (
            <button
              type="button"
              disabled={pending}
              className="px-3.5 py-2 rounded-none border border-[#1C1B1A] text-[#1C1B1A] hover:bg-[#F6F3EC] font-bold text-xs uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
              onClick={() => go('resync', () => resyncPortalHost(companyId), 'Re-sync queued')}
            >
              {label_('resync', 'Re-sync now', 'Queuing…')}
            </button>
          ) : null}
          {canAdmin && primary ? (
            <button
              type="button"
              disabled={pending}
              className="px-3.5 py-2 rounded-none border border-[#BA1A1A]/40 text-[#BA1A1A] hover:bg-[#BA1A1A]/10 font-bold text-xs uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
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
              className="px-3.5 py-2 rounded-none border border-[#BA1A1A]/40 text-[#BA1A1A] hover:bg-[#BA1A1A]/10 font-bold text-xs uppercase tracking-[0.08em] transition-colors disabled:opacity-50"
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
          <div className="pt-3 border-t border-[#CCC5BD] space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Old addresses</p>
            {redirects.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-none bg-[#F6F3EC] border border-[#CCC5BD] px-3 py-2">
                <div>
                  <p className="font-mono text-xs text-[#1C1B1A]">{redirectUrls[row.id] || row.hostname}</p>
                  <p className="text-[11px] text-[#7C766F]">
                    {row.status === 'unparking' || row.desired === 'unparked'
                      ? 'Removing…'
                      : `Redirects until ${formatWhen(row.redirect_until)}`}
                  </p>
                </div>
                {canAdmin && row.role === 'redirect' && row.desired === 'parked' ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="px-2.5 py-1.5 rounded-none border border-[#BA1A1A]/40 text-[#BA1A1A] hover:bg-[#BA1A1A]/10 text-[11px] font-bold uppercase tracking-[0.08em] disabled:opacity-50 transition-colors"
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
    </div>
  )
}
