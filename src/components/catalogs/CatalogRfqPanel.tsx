'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { requestCatalogQuotation } from '@/app/portal/actions'
import { submitShareCatalogRfq } from '@/app/share/catalogs/actions'
import { formatCurrency } from '@/lib/utils'

export type CatalogRfqOffering = {
  id: string
  name: string
  sku?: string | null
  price?: number | null
  moq: number
}

type Mode = 'portal' | 'guest' | 'client-share' | 'staff' | 'unassigned'

export function CatalogRfqPanel({
  offerings,
  mode,
  catalogId,
  shareToken,
  loginHref,
}: {
  offerings: CatalogRfqOffering[]
  mode: Mode
  catalogId?: string
  shareToken?: string
  loginHref?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [qty, setQty] = useState<Record<string, string>>({})
  const [deadline, setDeadline] = useState('')
  const [notes, setNotes] = useState('')
  const [contact, setContact] = useState({ full_name: '', email: '', company_name: '', phone: '' })
  const [fax, setFax] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  if (!offerings.length) return null

  if (mode === 'staff') {
    return (
      <section id="request-quotation" className="rounded-2xl border border-[#E5DFD5] bg-white p-5 text-sm text-[#5A5248]">
        Staff preview. Clients request a quotation from their portal, or from this link after they sign in.
      </section>
    )
  }

  if (mode === 'unassigned') {
    return (
      <section id="request-quotation" className="rounded-2xl border border-[#E5DFD5] bg-white p-5 text-sm text-[#5A5248]">
        This catalog is not assigned to your company. Sign in with that company account, or ask your account manager to assign it.
      </section>
    )
  }

  if (done) {
    return (
      <section id="request-quotation" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
        Request received. We will prepare a quotation from the quantities you sent.
      </section>
    )
  }

  const toggle = (id: string, moq: number) => {
    setSelected((current) => ({ ...current, [id]: !current[id] }))
    setQty((current) => (current[id] ? current : { ...current, [id]: String(moq) }))
  }

  const submit = async () => {
    const lines = offerings
      .filter((offering) => selected[offering.id])
      .map((offering) => ({
        id: offering.id,
        quantity: Number.parseInt(qty[offering.id] || String(offering.moq), 10),
      }))
    if (!lines.length) {
      toast.error('Select at least one product')
      return
    }

    setLoading(true)
    const result = mode === 'portal'
      ? await requestCatalogQuotation({ catalogId: catalogId || '', deadline, notes, lines })
      : await submitShareCatalogRfq({
          token: shareToken || '',
          deadline,
          notes,
          lines,
          full_name: contact.full_name,
          email: contact.email,
          company_name: contact.company_name,
          phone: contact.phone,
          fax,
        })
    setLoading(false)

    if (result && 'error' in result && result.error) {
      toast.error(result.error)
      return
    }

    toast.success('Request for quotation sent')
    if (mode === 'guest') {
      setDone(true)
      return
    }
    router.push('/portal/requirements')
    router.refresh()
  }

  return (
    <section id="request-quotation" className="rounded-2xl border border-[#E5DFD5] bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-[#1C1917]">Request Quotation</h2>
      <p className="mt-1 text-sm text-[#5A5248]">
        Choose products, enter a quantity for each, and send an RFQ to your account manager.
      </p>

      {mode === 'guest' && loginHref && (
        <p className="mt-3 text-sm">
          <a href={loginHref} className="font-semibold text-[#806A50] underline">
            Sign in
          </a>
          {' '}if you already have a portal account. Otherwise leave your contact details below.
        </p>
      )}

      <ul className="mt-4 divide-y divide-[#E8E4DE] rounded-xl border border-[#E8E4DE]">
        {offerings.map((offering) => (
          <li key={offering.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(selected[offering.id])}
                onChange={() => toggle(offering.id, offering.moq)}
              />
              <span>
                <span className="font-medium text-[#1C1917]">{offering.name}</span>
                {offering.sku && <span className="mt-0.5 block font-mono text-[10px] text-[#7A7267]">{offering.sku}</span>}
                <span className="mt-0.5 block text-xs text-[#7A7267]">
                  {offering.price != null ? formatCurrency(offering.price) : 'Price on quotation'}
                  {` · MOQ ${offering.moq}`}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-xs text-[#5A5248] sm:shrink-0">
              Qty
              <input
                type="number"
                min={offering.moq}
                step={1}
                value={qty[offering.id] ?? String(offering.moq)}
                onChange={(event) => setQty((current) => ({ ...current, [offering.id]: event.target.value }))}
                className="min-h-10 w-24 rounded-lg border border-[#E8E4DE] px-2"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-[#1C1917]">Delivery date</span>
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
          />
        </label>
        {mode === 'guest' && (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[#1C1917]">Your name</span>
              <input
                value={contact.full_name}
                onChange={(event) => setContact({ ...contact, full_name: event.target.value })}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[#1C1917]">Work email</span>
              <input
                type="email"
                value={contact.email}
                onChange={(event) => setContact({ ...contact, email: event.target.value })}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[#1C1917]">Company</span>
              <input
                value={contact.company_name}
                onChange={(event) => setContact({ ...contact, company_name: event.target.value })}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-[#1C1917]">Phone (optional)</span>
              <input
                value={contact.phone}
                onChange={(event) => setContact({ ...contact, phone: event.target.value })}
                className="min-h-11 w-full rounded-lg border border-[#E8E4DE] px-3"
              />
            </label>
            <input
              type="text"
              name="fax"
              tabIndex={-1}
              autoComplete="off"
              value={fax}
              onChange={(event) => setFax(event.target.value)}
              className="hidden"
              aria-hidden="true"
            />
          </>
        )}
      </div>

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-medium text-[#1C1917]">Notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[#E8E4DE] px-3 py-2"
          placeholder="Branding, delivery city, or anything else we should know"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#806A50] px-5 text-sm font-semibold text-white hover:bg-[#9C8567] disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Request Quotation'}
      </button>
    </section>
  )
}
