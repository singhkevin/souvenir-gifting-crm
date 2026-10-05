'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  emailCatalogLink,
  extendCatalogShareLink,
  generateCatalogShareLink,
  revokeCatalogShareLink,
} from './actions'
import { formatDate } from '@/lib/utils'

export function CatalogSharePanel({
  catalogId,
  catalogName,
  shareUrl,
  expiresAt,
  linkExpired,
  suggestions,
}: {
  catalogId: string
  catalogName: string
  shareUrl: string | null
  expiresAt: string | null
  linkExpired: boolean
  suggestions: { email: string; label: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [url, setUrl] = useState(shareUrl)
  const [shownExpiry, setShownExpiry] = useState(expiresAt)
  const [expired, setExpired] = useState(linkExpired)
  const [noExpiry, setNoExpiry] = useState(false)
  const [email, setEmail] = useState(suggestions[0]?.email || '')

  const run = (
    action: (formData: FormData) => Promise<{ error?: string; url?: string | null; expiresAt?: string | null; expired?: boolean } | undefined>,
    extra?: (formData: FormData) => void,
  ) => {
    const formData = new FormData()
    formData.set('campaign_id', catalogId)
    extra?.(formData)
    startTransition(async () => {
      const result = await action(formData)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      if (result && 'url' in result) setUrl(result.url ?? null)
      if (result && 'expiresAt' in result) setShownExpiry(result.expiresAt ?? null)
      if (result && 'expired' in result) setExpired(Boolean(result.expired))
      toast.success('Updated')
    })
  }

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
              onClick={() => run(extendCatalogShareLink)}
              className="min-h-10 rounded-lg border px-3 font-semibold disabled:opacity-50"
            >
              Extend 30 days
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(revokeCatalogShareLink)}
              className="min-h-10 rounded-lg border border-red-200 px-3 font-semibold text-red-700 disabled:opacity-50"
            >
              Revoke link
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#7A7267]">No active link. Publish products before sharing so the page is not empty.</p>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault()
          run(generateCatalogShareLink, (formData) => {
            if (noExpiry) formData.set('no_expiry', '1')
          })
        }}
      >
        <label className="flex items-center gap-2 text-[#5A5248]">
          <input type="checkbox" checked={noExpiry} onChange={(event) => setNoExpiry(event.target.checked)} />
          No expiry
        </label>
        <button type="submit" disabled={pending} className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
          {pending ? 'Working…' : url ? 'Regenerate link' : 'Generate 30-day link'}
        </button>
      </form>

      <form
        className="grid gap-2 md:grid-cols-[1fr_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const formData = new FormData(event.currentTarget)
          formData.set('campaign_id', catalogId)
          startTransition(async () => {
            const result = await emailCatalogLink(formData)
            if (result?.error) {
              toast.error(result.error)
              return
            }
            toast.success('Email sent')
          })
        }}
      >
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
        <button type="submit" disabled={pending || !url} className="min-h-10 rounded-lg bg-[#806A50] px-3 font-semibold text-white disabled:opacity-50">
          Email link
        </button>
        {mailto ? (
          <a href={mailto} className="inline-flex min-h-10 items-center justify-center rounded-lg border px-3 font-semibold text-[#806A50]">
            Open mail app
          </a>
        ) : (
          <span />
        )}
      </form>
      <p className="text-[#7A7267]">
        Email uses the existing Resend sender when RESEND_API_KEY is set. Otherwise copy the link or use Open mail app.
      </p>
    </div>
  )
}
