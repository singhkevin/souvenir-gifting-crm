'use client'

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react'
import { quickCreateCompany } from '@/app/crm/companies/actions'
import { createContact } from '@/app/crm/contacts/actions'
import { ActionPendingContext, IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'
import { SubmitButton } from '@/components/ui/submit-button'

export type QuickCompany = { id: string; name: string }
export type QuickContact = { id: string; full_name: string; company_id: string }

function companyFromResult(result: unknown): QuickCompany | null {
  if (!result || typeof result !== 'object' || !('company' in result)) return null
  const company = (result as { company?: { id?: unknown; name?: unknown } }).company
  if (!company || typeof company.id !== 'string' || typeof company.name !== 'string' || !company.name) return null
  return { id: company.id, name: company.name }
}

function contactFromResult(result: unknown): QuickContact | null {
  if (!result || typeof result !== 'object' || !('contact' in result)) return null
  const contact = (result as { contact?: { id?: unknown; full_name?: unknown; company_id?: unknown } }).contact
  if (!contact || typeof contact.id !== 'string' || typeof contact.full_name !== 'string' || typeof contact.company_id !== 'string') {
    return null
  }
  return { id: contact.id, full_name: contact.full_name, company_id: contact.company_id }
}

function useModalBehavior(onClose: () => void, pending: boolean) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, pending])
}

function QuickModalShell({
  title,
  pending,
  onClose,
  children,
}: {
  title: string
  pending: boolean
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  useModalBehavior(onClose, pending)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[#806A50]/45"
        onClick={() => {
          if (!pending) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md border border-[var(--color-border)] bg-white p-5"
      >
        <h2 id={titleId} className="text-lg font-bold text-[var(--color-primary)]">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

const fieldClass = 'mt-1 min-h-11 w-full border px-3 py-2 text-sm'
const labelClass = 'text-xs font-semibold text-gray-700'

export function QuickCompanyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (company: QuickCompany) => void
}) {
  if (!open) return null
  return <QuickCompanyDialog onClose={onClose} onCreated={onCreated} />
}

function QuickCompanyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (company: QuickCompany) => void
}) {
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set(IDEMPOTENCY_FIELD, key)
    run(() => quickCreateCompany(formData), {
      successMessage: 'Company added',
      refresh: false,
      onSuccess: (result) => {
        const company = companyFromResult(result)
        if (!company) return
        rotate()
        onCreated(company)
        onClose()
      },
    })
  }

  return (
    <QuickModalShell title="Add Company" pending={pending} onClose={onClose}>
      <ActionPendingContext.Provider value={{ pending, submitter: null }}>
      <form onSubmit={onSubmit} className="grid gap-4 text-sm">
        {error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <label className="block">
          <span className={labelClass}>Company name</span>
          <input ref={nameRef} name="name" required className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Domain</span>
          <input name="allowed_email_domains" placeholder="acme.com" className={fieldClass} />
          <span className="mt-1 block text-[11px] text-gray-500">Portal email domain · for example acme.com</span>
        </label>
        <label className="block">
          <span className={labelClass}>City</span>
          <input name="city" className={fieldClass} />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center border border-[#E8E4DE] bg-white px-4 text-sm font-semibold text-[#1B2430] disabled:opacity-60"
          >
            Cancel
          </button>
          <SubmitButton
            className="inline-flex min-h-11 items-center justify-center bg-[#806A50] px-4 text-sm font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
            pendingLabel="Creating…"
          >
            Create company
          </SubmitButton>
        </div>
        </fieldset>
      </form>
      </ActionPendingContext.Provider>
    </QuickModalShell>
  )
}

export function QuickContactModal({
  open,
  companyId,
  companyName,
  onClose,
  onCreated,
}: {
  open: boolean
  companyId: string
  companyName: string
  onClose: () => void
  onCreated: (contact: QuickContact) => void
}) {
  if (!open || !companyId) return null
  return (
    <QuickContactDialog
      companyId={companyId}
      companyName={companyName}
      onClose={onClose}
      onCreated={onCreated}
    />
  )
}

function QuickContactDialog({
  companyId,
  companyName,
  onClose,
  onCreated,
}: {
  companyId: string
  companyName: string
  onClose: () => void
  onCreated: (contact: QuickContact) => void
}) {
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set(IDEMPOTENCY_FIELD, key)
    run(() => createContact(formData), {
      successMessage: 'Contact added',
      refresh: false,
      onSuccess: (result) => {
        const contact = contactFromResult(result)
        if (!contact) return
        rotate()
        onCreated(contact)
        onClose()
      },
    })
  }

  return (
    <QuickModalShell title="Add Contact" pending={pending} onClose={onClose}>
      <ActionPendingContext.Provider value={{ pending, submitter: null }}>
      <form onSubmit={onSubmit} className="grid gap-4 text-sm">
        <p className="text-xs text-gray-600">
          Adding a contact for <span className="font-semibold text-[#1B2430]">{companyName}</span>
        </p>
        {error ? (
          <div className="border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <fieldset disabled={pending} className="m-0 grid min-w-0 gap-4 border-0 p-0">
        <input type="hidden" name="company_id" value={companyId} />
        <input type="hidden" name="contact_type" value="primary" />
        <label className="block">
          <span className={labelClass}>Full name</span>
          <input ref={nameRef} name="full_name" required className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input name="email" type="email" className={fieldClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Phone</span>
          <input name="phone" className={fieldClass} />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center border border-[#E8E4DE] bg-white px-4 text-sm font-semibold text-[#1B2430] disabled:opacity-60"
          >
            Cancel
          </button>
          <SubmitButton
            className="inline-flex min-h-11 items-center justify-center bg-[#806A50] px-4 text-sm font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
            pendingLabel="Creating…"
          >
            Create contact
          </SubmitButton>
        </div>
        </fieldset>
      </form>
      </ActionPendingContext.Provider>
    </QuickModalShell>
  )
}
