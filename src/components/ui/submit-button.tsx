'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useActionPending } from '@/lib/use-action'

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  children: ReactNode
  /** Short label while the action runs, e.g. "Saving…". */
  pendingLabel?: string
}

/**
 * Submit button for an ActionForm (or any form using `action`).
 * Disables itself, shows a spinner and the pending label until the action settles.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Saving…',
  disabled,
  className = '',
  ...rest
}: SubmitButtonProps) {
  const { busy, active } = useActionPending(rest.name, rest.value)
  return (
    <button
      {...rest}
      type="submit"
      disabled={busy || disabled}
      aria-busy={active || undefined}
      className={`${className} ${active ? 'cursor-wait opacity-70' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {active ? (
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
