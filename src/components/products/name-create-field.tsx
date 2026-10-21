'use client'

import { useState } from 'react'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export function NameCreateField({
  name,
  label,
  required = false,
  options,
  defaultValue = '',
  emptyLabel,
  placeholder,
  create,
}: {
  name: string
  label: string
  required?: boolean
  options: { id: string; name: string }[]
  defaultValue?: string
  emptyLabel: string
  placeholder: string
  create: (name: string) => Promise<{ id: string; name: string } | { error: string }>
}) {
  const [rows, setRows] = useState(options)
  const [value, setValue] = useState(defaultValue)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const save = async () => {
    setError(null)
    setPending(true)
    const result = await create(draft)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setRows((current) => (current.some((row) => row.id === result.id) ? current : [...current, result].sort((a, b) => a.name.localeCompare(b.name))))
    setValue(result.id)
    setDraft('')
    setAdding(false)
  }

  return (
    <div>
      <input type="hidden" name={name} value={value} required={required} />
      <MobileSheetSelect
        label={required ? `${label} *` : label}
        showDesktopLabel
        value={value}
        onChange={(next) => {
          if (next === '__new__') {
            setAdding(true)
            return
          }
          setValue(next)
        }}
        emptyLabel={emptyLabel}
        options={[
          { value: '', label: emptyLabel },
          ...rows.map((row) => ({ value: row.id, label: row.name })),
          { value: '__new__', label: `+ New ${label.toLowerCase()}` },
        ]}
      />
      {adding && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={placeholder}
            className="w-full border border-gray-200 px-3 py-2 text-xs"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={() => void save()}
            className="bg-[#806A50] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Add'}
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  )
}
