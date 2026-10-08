'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'

type ActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick'> & {
  /**
   * Server action (bind arguments with `.bind`) or any async function. It receives a per-click
   * idempotency key as its last argument; creating actions pass it to `withIdempotency`.
   */
  action: (idempotencyKey: string) => Promise<unknown> | unknown
  children: ReactNode
  pendingLabel?: string
  successMessage?: string | false
  onSuccess?: (result: unknown) => void
}

/** A click-to-mutate button with the same pending / lock / toast / refresh behaviour as ActionForm. */
export function ActionButton({
  action,
  children,
  pendingLabel = 'Working…',
  successMessage,
  onSuccess,
  disabled,
  className = '',
  ...rest
}: ActionButtonProps) {
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  return (
    <button
      {...rest}
      type="button"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={() =>
        run(() => action(key), {
          successMessage,
          onSuccess: (result) => {
            rotate()
            onSuccess?.(result)
          },
        })
      }
      className={`${className} ${pending ? 'cursor-wait opacity-70' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center justify-center gap-2">
          <Spinner />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
