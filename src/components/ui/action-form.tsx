'use client'

import { useState, useTransition, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'

export function ActionForm({
  action,
  children,
  className,
  successMessage,
}: {
  action: (fd: FormData) => Promise<unknown>
  children: ReactNode
  className?: string
  successMessage?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await action(fd)
      if (res && typeof res === 'object' && 'error' in res && (res as { error?: string }).error) {
        const message = String((res as { error: string }).error)
        setError(message)
        toast.error(message)
      } else if (successMessage) {
        toast.success(successMessage)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      {error && (
        <div className="col-span-full mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
    </form>
  )
}
