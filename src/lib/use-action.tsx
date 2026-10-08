'use client'

import { createContext, useCallback, useContext, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { toast } from 'sonner'

/** Form field / argument name the server reads with `withIdempotency`. */
export const IDEMPOTENCY_FIELD = 'idempotency_key'

export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
}

/** One key per intended submission. Call `rotate()` after a success so the next submit is a new request. */
export function useIdempotencyKey() {
  const [key, setKey] = useState(newIdempotencyKey)
  const rotate = useCallback(() => setKey(newIdempotencyKey()), [])
  return { key, rotate }
}

export function resultError(result: unknown): string | null {
  if (result && typeof result === 'object' && 'error' in result) {
    const error = (result as { error?: unknown }).error
    if (typeof error === 'string' && error) return error
  }
  return null
}

function resultMessage(result: unknown): string | null {
  if (result && typeof result === 'object' && 'message' in result) {
    const message = (result as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return null
}

function isRedirectError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}

export type RunOptions = {
  successMessage?: string | false
  /** Refresh server data after success. Default true. */
  refresh?: boolean
  onSuccess?: (result: unknown) => void
  onError?: (message: string) => void
}

/**
 * Shared guard for every mutating click.
 *
 * - `pending` drives spinners and disabled controls.
 * - A ref lock rejects a second call made before React re-renders (double-click in one tick).
 * - Errors are shown as a toast and returned to the caller; success refreshes server data.
 */
export function useAction() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)

  const run = useCallback(
    (fn: () => Promise<unknown> | unknown, options: RunOptions = {}) => {
      if (lock.current) return false
      lock.current = true
      setError(null)
      startTransition(async () => {
        try {
          const result = await fn()
          const message = resultError(result)
          if (message) {
            setError(message)
            toast.error(message)
            options.onError?.(message)
            return
          }
          if (options.successMessage !== false) {
            toast.success(resultMessage(result) || options.successMessage || 'Saved')
          }
          options.onSuccess?.(result)
          if (options.refresh !== false) router.refresh()
        } catch (caught) {
          if (isRedirectError(caught)) {
            // A redirect is how many actions report success; let the router navigate.
            options.onSuccess?.(undefined)
            throw caught
          }
          const message = caught instanceof Error && caught.message ? caught.message : 'Something went wrong. Please try again.'
          setError(message)
          toast.error(message)
          options.onError?.(message)
        } finally {
          lock.current = false
        }
      })
      return true
    },
    [router],
  )

  return { pending, error, run, clearError: () => setError(null) }
}

/**
 * Lets a SubmitButton read the pending state of the ActionForm that wraps it.
 * `submitter` is the `name=value` of the button that was clicked, so a form with two
 * submit buttons only shows the spinner on the one that was used.
 */
export type ActionPendingState = { pending: boolean; submitter: string | null }

export const ActionPendingContext = createContext<ActionPendingState>({ pending: false, submitter: null })

export function submitterKey(el: unknown): string | null {
  if (!el || typeof el !== 'object') return null
  const { name, value } = el as { name?: unknown; value?: unknown }
  return typeof name === 'string' && name ? `${name}=${String(value ?? '')}` : null
}

/** `busy`: the form is pending. `active`: this button is the one that started it. */
export function useActionPending(buttonName?: string, buttonValue?: unknown) {
  const { pending: fromForm, submitter } = useContext(ActionPendingContext)
  const { pending: nativePending } = useFormStatus()
  const busy = fromForm || nativePending
  const own = buttonName ? `${buttonName}=${String(buttonValue ?? '')}` : null
  const active = busy && (submitter === null || own === null || submitter === own)
  return { busy, active }
}
