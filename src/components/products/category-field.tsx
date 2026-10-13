'use client'

import { useState } from 'react'
import { createCategory } from '@/app/crm/products/actions'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { sortProductCategories } from '@/lib/products/categories'

export function CategoryField({
  categories,
  defaultValue = '',
}: {
  categories: { id: string; name: string }[]
  defaultValue?: string
}) {
  const [rows, setRows] = useState(categories)
  const [value, setValue] = useState(defaultValue)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const save = async () => {
    setError(null)
    setPending(true)
    const result = await createCategory(name)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setRows((current) => (current.some((row) => row.id === result.id) ? current : [...current, result]))
    setValue(result.id)
    setName('')
    setAdding(false)
  }

  return (
    <div>
      <input type="hidden" name="category_id" value={value} required />
      <MobileSheetSelect
        label="Category *"
        showDesktopLabel
        value={value}
        onChange={(next) => {
          if (next === '__new__') {
            setAdding(true)
            return
          }
          setValue(next)
        }}
        emptyLabel="Select Category"
        options={[
          { value: '', label: 'Select Category' },
          ...sortProductCategories(rows).map((category) => ({ value: category.id, label: category.name })),
          { value: '__new__', label: '+ New category' },
        ]}
      />
      {adding && (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New category name"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
          />
          <button
            type="button"
            disabled={pending || !name.trim()}
            onClick={() => void save()}
            className="rounded-lg bg-[#806A50] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Add'}
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-[11px] text-red-700">{error}</p> : null}
    </div>
  )
}
