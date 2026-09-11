'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

export function ConfirmAction({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  action,
  children,
  destructive = true,
  hiddenFields,
}: {
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  action: (formData: FormData) => void | Promise<void>
  children: ReactNode
  destructive?: boolean
  hiddenFields?: Record<string, string>
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <div className="text-xs text-gray-600 space-y-2">{description}</div>
            <form
              action={action}
              className="flex justify-end gap-2 pt-2"
              onSubmit={() => setOpen(false)}
            >
              {Object.entries(hiddenFields || {}).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                className={
                  destructive
                    ? 'px-3 py-2 text-xs font-semibold rounded-lg bg-red-700 text-white hover:bg-red-800'
                    : 'px-3 py-2 text-xs font-semibold rounded-lg bg-[#1A3022] text-white'
                }
              >
                {confirmLabel}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
