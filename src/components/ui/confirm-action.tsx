'use client'

import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ActionPendingContext, useAction } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

export function ConfirmAction({
  title,
  description,
  confirmLabel = 'Delete',
  pendingLabel = 'Working…',
  cancelLabel = 'Cancel',
  action,
  children,
  destructive = true,
  hiddenFields,
  successMessage = 'Done',
}: {
  title: string
  description: ReactNode
  confirmLabel?: string
  pendingLabel?: string
  cancelLabel?: string
  action: (formData: FormData) => Promise<unknown> | unknown
  children: ReactNode
  destructive?: boolean
  hiddenFields?: Record<string, string>
  successMessage?: string
}) {
  const [open, setOpen] = useState(false)
  const { pending, error, run, clearError } = useAction()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    // The dialog stays open and disabled until the action settles; it closes only on success.
    run(() => action(formData), { successMessage, onSuccess: () => setOpen(false) })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          clearError()
          setOpen(true)
        }}
        className={
          destructive
            ? 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50'
            : 'px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50'
        }
      >
        {children}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-busy={pending || undefined}
          >
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <div className="text-xs text-gray-600 space-y-2">{description}</div>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
                {error}
              </div>
            ) : null}
            <ActionPendingContext.Provider value={{ pending, submitter: null }}>
              <form onSubmit={onSubmit} className="flex justify-end gap-2 pt-2">
                {Object.entries(hiddenFields || {}).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending || undefined}
                  className={
                    (destructive
                      ? 'px-3 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white hover:bg-red-800'
                      : 'px-3 py-2 text-xs font-semibold rounded-lg bg-[#806A50] text-[#FFFFFF]') +
                    ' disabled:cursor-wait disabled:opacity-70'
                  }
                >
                  {pending ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner />
                      {pendingLabel}
                    </span>
                  ) : (
                    confirmLabel
                  )}
                </button>
              </form>
            </ActionPendingContext.Provider>
          </div>
        </div>
      ) : null}
    </>
  )
}
