'use client'

import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ActionPendingContext, IDEMPOTENCY_FIELD, submitterKey, useAction, useIdempotencyKey } from '@/lib/use-action'

/**
 * Form wrapper for every mutating form.
 *
 * - One submission at a time (ref lock + useTransition); controls are disabled while pending.
 * - Sends a per-submission `idempotency_key` the server can dedupe on (see `withIdempotency`).
 * - Shows the server's `{ error }` inline and as a toast, a success toast otherwise,
 *   and refreshes server data when the action settles.
 * - Works with `<SubmitButton>` for the spinner / pending label.
 */
export function ActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
  refresh = true,
  onSuccess,
}: {
  action: (fd: FormData) => Promise<unknown> | unknown
  children: ReactNode
  className?: string
  successMessage?: string
  /** Clear the fields after a successful save (create forms that stay on the page). */
  resetOnSuccess?: boolean
  refresh?: boolean
  onSuccess?: (result: unknown) => void
}) {
  const { pending, error, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const formRef = useRef<HTMLFormElement>(null)
  const [submitter, setSubmitter] = useState<string | null>(null)

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    // Pass the clicked button so `<button name="decision" value="approved">` is part of the data.
    const clicked = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const fd = new FormData(form, clicked)
    setSubmitter(submitterKey(clicked))
    fd.set(IDEMPOTENCY_FIELD, key)
    run(() => action(fd), {
      successMessage,
      refresh,
      onSuccess: (result) => {
        rotate()
        if (resetOnSuccess) formRef.current?.reset()
        onSuccess?.(result)
      },
    })
  }

  return (
    <ActionPendingContext.Provider value={{ pending, submitter }}>
      <form ref={formRef} onSubmit={onSubmit} className={className} aria-busy={pending || undefined}>
        {error && (
          <div className="col-span-full mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
      </form>
    </ActionPendingContext.Provider>
  )
}
