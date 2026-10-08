'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  emailCatalogLink,
  extendCatalogShareLink,
  generateCatalogShareLink,
  revokeCatalogShareLink,
} from './actions'
import { formatDate } from '@/lib/utils'
import { ActionForm } from '@/components/ui/action-form'
import { Spinner, SubmitButton } from '@/components/ui/submit-button'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'

type ShareResult = { error?: string; url?: string | null; expiresAt?: string | null; expired?: boolean } | undefined

export function CatalogSharePanel({
  catalogId,
  catalogName,
  shareUrl,
  expiresAt,
  linkExpired,
  suggestions,
  companies,
  linkCompanyName,
}: {
  catalogId: string
  catalogName: string
  shareUrl: string | null
  expiresAt: string | null
  linkExpired: boolean
  suggestions: { email: string; label: string }[]
  /** Assigned companies. With more than one, the link can be priced for a specific company. */
  companies: { id: string; name: string }[]
  linkCompanyName: string | null
}) {
  const { pending, run: runAction } = useAction()
  const [active, setActive] = useState<'extend' | 'revoke' | null>(null)
  const extendKey = useIdempotencyKey()
  const revokeKey = useIdempotencyKey()
  const [url, setUrl] = useState(shareUrl)
  const [shownExpiry, setShownExpiry] = useState(expiresAt)
  const [expired, setExpired] = useState(linkExpired)
  const [noExpiry, setNoExpiry] = useState(false)
  const [email, setEmail] = useState(suggestions[0]?.email || '')

  const applyResult = (raw: unknown) => {
    const result = raw as ShareResult
    if (result && 'url' in result) setUrl(result.url ?? null)
    if (result && 'expiresAt' in result) setShownExpiry(result.expiresAt ?? null)
    if (result && 'expired' in result) setExpired(Boolean(result.expired))
  }

  const runLink = (
    which: 'extend' | 'revoke',
    action: (formData: FormData) => Promise<ShareResult>,
    idem: { key: string; rotate: () => void },
    successMessage: string,
  ) => {
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    formData.set(IDEMPOTENCY_FIELD, idem.key)
    setActive(which)
    runAction(() => action(formData), {
      successMessage,
      onSuccess: (result) => {
        idem.rotate()
        applyResult(result)
      },
    })
  }

  const busyLabel = (which: 'extend' | 'revoke', text: string, pendingText: string) =>
    pending && active === which ? (
      <span className="inline-flex items-center justify-center gap-2">
        <Spinner />
        {pendingText}
      </span>
    ) : (
      text
    )

  const expiryLabel = !shownExpiry
    ? 'No expiry'
    : expired
      ? `Expired ${formatDate(shownExpiry)}`
      : `Expires ${formatDate(shownExpiry)}`

  const mailto = url && email
    ? `mailto:${email}?subject=${encodeURIComponent(`Catalog: ${catalogName}`)}&body=${encodeURIComponent(`Here is the catalog:\n${url}`)}`
    : null

  return (
    <div className="space-y-3 rounded-2xl border bg-white p-4 text-xs">
      <div>
        <h2 className="font-serif text-base text-[#1C1917]">Share link</h2>
        <p className="mt-1 text-[#7A7267]">
          Anyone with the link can browse published products and client sell prices. Supplier cost is not included.
          New links last 30 days unless you choose no expiry.
        </p>
      </div>

      {url ? (
        <div className="space-y-2">
          <p className="break-all rounded-lg bg-[#FAF7F2] px-3 py-2 font-mono text-[11px]">{url}</p>
          <p className="text-[#7A7267]">{expiryLabel}</p>
          <p className="text-[#7A7267]">
            Prices on this link: {linkCompanyName ? `${linkCompanyName}'s margin` : companies.length > 1 ? 'the signed-in client\'s company, otherwise the catalog default' : 'the assigned company\'s margin'}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-10 rounded-lg border px-3 font-semibold"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url)
                  toast.success('Link copied')
                } catch {
                  toast.error('Could not copy. Select the link and copy it manually.')
                }
              }}
            >
              Copy link
            </button>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending && active === 'extend' ? true : undefined}
              onClick={() => runLink('extend', extendCatalogShareLink, extendKey, 'Link extended')}
              className="min-h-10 rounded-lg border px-3 font-semibold disabled:opacity-50"
            >
              {busyLabel('extend', 'Extend 30 days', 'Extending…')}
            </button>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending && active === 'revoke' ? true : undefined}
              onClick={() => runLink('revoke', revokeCatalogShareLink, revokeKey, 'Link revoked')}
              className="min-h-10 rounded-lg border border-red-200 px-3 font-semibold text-red-700 disabled:opacity-50"
            >
              {busyLabel('revoke', 'Revoke link', 'Revoking…')}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#7A7267]">No active link. Publish products before sharing so the page is not empty.</p>
      )}

      <ActionForm
        action={generateCatalogShareLink}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        successMessage="Share link updated"
        onSuccess={applyResult}
      >
        <input type="hidden" name="campaign_id" value={catalogId} />
        {companies.length > 1 && (
          <label className="flex items-center gap-2 text-[#5A5248]">
            Price for
            <select name="company_id" defaultValue="" className="min-h-10 rounded-lg border bg-white px-2 py-2">
              <option value="">Each viewer&apos;s company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-[#5A5248]">
          <input type="checkbox" name="no_expiry" value="1" checked={noExpiry} onChange={(event) => setNoExpiry(event.target.checked)} />
          No expiry
        </label>
        <SubmitButton pendingLabel="Generating…" className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
          {url ? 'Regenerate link' : 'Generate 30-day link'}
        </SubmitButton>
      </ActionForm>

      <ActionForm
        action={emailCatalogLink}
        className="grid gap-2 md:grid-cols-[1fr_auto_auto]"
        successMessage="Email sent"
      >
        <input type="hidden" name="campaign_id" value={catalogId} />
        <input
          name="email"
          type="email"
          required
          list="catalog-poc-emails"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Client POC email"
          className="min-h-10 rounded-lg border px-3 py-2"
        />
        <datalist id="catalog-poc-emails">
          {suggestions.map((row) => (
            <option key={row.email} value={row.email}>{row.label}</option>
          ))}
        </datalist>
        <SubmitButton disabled={!url} pendingLabel="Sending…" className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
          Email link
        </SubmitButton>
        {mailto ? (
          <a href={mailto} className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 font-semibold text-[#806A50]">
            Open mail app
          </a>
        ) : (
          <span />
        )}
      </ActionForm>
      <p className="text-[#7A7267]">
        Email uses the existing Resend sender when RESEND_API_KEY is set. Otherwise copy the link or use Open mail app.
      </p>
    </div>
  )
}
