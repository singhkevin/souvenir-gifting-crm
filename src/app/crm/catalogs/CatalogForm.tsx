'use client'

import { useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'

export function CatalogForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<unknown>
  className?: string
  children: ReactNode
}) {
  const [pending, startTransition] = useTransition()

  return (
    <form
      className={className}
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault()
        if (pending) return
        const formData = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await action(formData)
          if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string' && result.error) {
            toast.error(result.error)
            return
          }
          if (result && typeof result === 'object' && 'success' in result && result.success) {
            toast.success('Saved')
          }
        })
      }}
    >
      {children}
    </form>
  )
}
