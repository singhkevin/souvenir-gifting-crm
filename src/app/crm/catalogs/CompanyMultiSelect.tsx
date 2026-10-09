'use client'

import { useState } from 'react'

/** Optional multi-select. Posts one `company_id` per ticked company; none ticked is valid. */
export function CompanyMultiSelect({
  companies,
  name = 'company_id',
  label = 'Assign to companies',
}: {
  companies: { id: string; name: string }[]
  name?: string
  label?: string
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const visible = companies.filter(
    (company) => selected.has(company.id) || company.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <fieldset className="block min-w-0 space-y-1">
      <legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">
        {label} <span className="font-normal normal-case tracking-normal">(optional{selected.size ? `, ${selected.size} selected` : ''})</span>
      </legend>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search companies"
        aria-label="Search companies"
        className="min-h-9 w-full rounded-lg border px-3 py-1.5"
      />
      <ul className="max-h-36 space-y-0.5 overflow-y-auto rounded-lg border bg-white p-1">
        {visible.length === 0 && <li className="px-2 py-1 text-[#7A7267]">No companies match.</li>}
        {visible.map((company) => (
          <li key={company.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[#FAF7F2]">
              <input
                type="checkbox"
                name={name}
                value={company.id}
                checked={selected.has(company.id)}
                onChange={() => toggle(company.id)}
              />
              <span className="truncate">{company.name}</span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
