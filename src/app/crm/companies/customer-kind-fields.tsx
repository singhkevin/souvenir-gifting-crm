'use client'

import { useState, type ReactNode } from 'react'

const fieldClass = 'mt-1 min-h-11 w-full border border-[var(--color-border)] px-3 py-2'

export function CustomerKindChooser({
  children,
  showContact = true,
}: {
  /** Portal fields. Shown only for a corporate microsite client. */
  children?: ReactNode
  showContact?: boolean
}) {
  const [kind, setKind] = useState<'corporate' | 'direct'>('corporate')
  const [individual, setIndividual] = useState(false)
  const direct = kind === 'direct'
  const person = direct && individual

  return (
    <div className="grid gap-4 md:col-span-2">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Customer</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="customer_kind"
            value="corporate"
            checked={kind === 'corporate'}
            onChange={() => {
              setKind('corporate')
              setIndividual(false)
            }}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Corporate client (microsite)</span>
            <span className="mt-0.5 block text-[11px] text-gray-500">Portal address, logins, and allowed email domains.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name="customer_kind"
            value="direct"
            checked={direct}
            onChange={() => setKind('direct')}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Direct customer (no microsite)</span>
            <span className="mt-0.5 block text-[11px] text-gray-500">Orders by phone, WhatsApp, or email. No portal login.</span>
          </span>
        </label>
      </fieldset>

      {direct ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="is_individual"
            value="1"
            checked={individual}
            onChange={(event) => setIndividual(event.target.checked)}
            className="mt-1"
          />
          <span>
            Individual · the record is the person, with one primary contact
          </span>
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="font-medium">{person ? "Person's name *" : 'Company name *'}</span>
        <input name="name" required className={fieldClass} />
      </label>

      {direct && showContact ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {person ? null : (
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Primary contact</span>
              <input name="contact_name" placeholder="Optional" className={fieldClass} />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input name="contact_email" type="email" placeholder="Optional" className={fieldClass} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Phone</span>
            <input name="contact_phone" placeholder="Optional" className={fieldClass} />
          </label>
          <p className="text-[11px] text-gray-500 sm:col-span-2">
            No portal address, subdomain, portal login, or allowed email domains.
          </p>
        </div>
      ) : null}

      {direct ? null : children}
    </div>
  )
}
