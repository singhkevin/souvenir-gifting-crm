'use client'

import type { ReactNode } from 'react'
import { ActionForm } from '@/components/ui/action-form'

export function CatalogForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<unknown>
  className?: string
  children: ReactNode
}) {
  return (
    <ActionForm action={action} className={className} successMessage="Saved">
      {children}
    </ActionForm>
  )
}
