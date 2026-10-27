'use client'

import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { quickCreateCompany } from '@/app/crm/companies/actions'
import { createContact } from '@/app/crm/contacts/actions'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

const triggerClass =
  'inline-flex min-h-11 shrink-0 items-center justify-center border border-[#806A50] bg-white px-3 text-xs font-semibold text-[#806A50] hover:bg-[#806A50] hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

function useDialogEffects(open: boolean, pending: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
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
  }, [open, pending, onClose])
}

function QuickDialog({
  title,
  description,
  pending,
  error,
  onClose,
  children,
}: {
  title: string
  description?: string
  pending: boolean
  error: string | null
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  useDialogEffects(true, pending, onClose)

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        disabled={pending}
        className="absolute inset-0 bg-[#1B2430]/40"
        onClick={() => {
          if (!pending) onClose()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md border border-[var(--color-border)] bg-white p-5 text-sm"
      >
        <h2 id={titleId} className="text-lg font-bold text-[var(--color-primary)]">
          {title}
        </h2>
        {description ? <p className="mt-1 text-xs text-gray-600">{description}</p> : null}
        {error ? (
          <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function QuickAddCompanyButton({
  onCreated,
}: {
  onCreated: (company: { id: string; name: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { pending, error, run, clearError } = useAction()
  const { key, rotate } = useIdempotencyKey()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set(IDEMPOTENCY_FIELD, key)
    run(() => quickCreateCompany(formData), {
      successMessage: 'Company added',
      refresh: false,
      onSuccess: (result) => {
        const created = result as { id?: string; name?: string }
        if (!created?.id || !created.name) return
        rotate()
        onCreated({ id: created.id, name: created.name })
        close()
      },
    })
  }

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          clearError()
          setOpen(true)
        }}
      >
        + Add Company
      </button>
      {open ? (
        <QuickDialog
          title="Add Company"
          description="The new company is selected on this requirement."
          pending={pending}
          error={error}
          onClose={close}
        >
          <form onSubmit={onSubmit} className="grid gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Company name</span>
              <input name="name" required autoFocus className="mt-1 min-h-11 w-full border px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Domain</span>
              <input
                name="domain"
                placeholder="acme.com"
                className="mt-1 min-h-11 w-full border px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">City</span>
              <input name="city" placeholder="Mumbai" className="mt-1 min-h-11 w-full border px-3 py-2" />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={close}
                className="inline-flex min-h-11 items-center border px-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center bg-[#806A50] px-4 text-sm font-semibold text-white hover:bg-[#9C8567] disabled:opacity-60"
              >
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Adding…
                  </span>
                ) : (
                  'Add Company'
                )}
              </button>
            </div>
          </form>
        </QuickDialog>
      ) : null}
    </>
  )
}

export function QuickAddContactButton({
  companyId,
  companyName,
  onCreated,
}: {
  companyId: string
  companyName: string
  onCreated: (contact: { id: string; full_name: string; company_id: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const { pending, error, run, clearError } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const disabled = !companyId

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    formData.set('company_id', companyId)
    formData.set(IDEMPOTENCY_FIELD, key)
    run(() => createContact(formData), {
      successMessage: 'Contact added',
      refresh: false,
      onSuccess: (result) => {
        const created = result as { id?: string; full_name?: string }
        if (!created?.id) return
        rotate()
        onCreated({
          id: created.id,
          full_name: created.full_name || String(formData.get('full_name') || 'Contact'),
          company_id: companyId,
        })
        close()
      },
    })
  }

  return (
    <>
      <button
        type="button"
        className={triggerClass}
        disabled={disabled}
        title={disabled ? 'Select a company first' : `Add a contact for ${companyName}`}
        onClick={() => {
          if (disabled) return
          clearError()
          setOpen(true)
        }}
      >
        + Add Contact
      </button>
      {open && companyId ? (
        <QuickDialog
          title="Add Contact"
          description={`Contact for ${companyName}. They are selected on this requirement.`}
          pending={pending}
          error={error}
          onClose={close}
        >
          <form onSubmit={onSubmit} className="grid gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Contact name</span>
              <input name="full_name" required autoFocus className="mt-1 min-h-11 w-full border px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Email</span>
              <input name="email" type="email" className="mt-1 min-h-11 w-full border px-3 py-2" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-700">Phone</span>
              <input name="phone" className="mt-1 min-h-11 w-full border px-3 py-2" />
            </label>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={close}
                className="inline-flex min-h-11 items-center border px-3 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-11 items-center justify-center bg-[#806A50] px-4 text-sm font-semibold text-white hover:bg-[#9C8567] disabled:opacity-60"
              >
                {pending ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner />
                    Adding…
                  </span>
                ) : (
                  'Add Contact'
                )}
              </button>
            </div>
          </form>
        </QuickDialog>
      ) : null}
    </>
  )
}
