'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { companyListLabel, dedupeById, type CompanyOption } from '@/lib/catalogs/company-option'

/** Compact searchable multi-select. Posts one hidden `company_id` per selected company. */
export function CompanyMultiSelect({
  companies,
  name = 'company_id',
  label = 'Assign to companies',
}: {
  companies: CompanyOption[]
  name?: string
  label?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const rows = dedupeById(companies)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const byId = new Map(rows.map((company) => [company.id, company]))
  const needle = query.trim().toLowerCase()
  const visible = rows.filter((company) => {
    if (!needle) return true
    const haystack = `${company.name} ${company.hint || ''}`.toLowerCase()
    return haystack.includes(needle)
  })

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const chosen = [...selected].map((id) => byId.get(id)).filter((company): company is CompanyOption => Boolean(company))

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]" id={`${listId}-label`}>
        {label} <span className="font-normal normal-case tracking-normal">(optional)</span>
      </span>
      <div className="flex min-h-11 flex-wrap items-center gap-1 border bg-white px-2 py-1">
        {chosen.map((company) => (
          <button
            key={company.id}
            type="button"
            onClick={() => toggle(company.id)}
            className="max-w-full truncate bg-[#FAF7F2] px-2 py-0.5 text-[11px] text-[#5A5248]"
          >
            {companyListLabel(company)} ×
          </button>
        ))}
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={chosen.length ? 'Add another' : 'Search companies'}
          aria-label="Search companies"
          aria-expanded={open}
          aria-controls={listId}
          className="min-h-8 min-w-[8rem] flex-1 bg-transparent px-1 py-1 outline-none"
        />
      </div>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={`${listId}-label`}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto border border-[#E5DFD5] bg-white p-1"
        >
          {visible.length === 0 && <li className="px-2 py-2 text-[#7A7267]">No companies match.</li>}
          {visible.map((company) => {
            const on = selected.has(company.id)
            return (
              <li key={company.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(company.id)}
                  className={`flex w-full items-start gap-2 px-2 py-1.5 text-left hover:bg-[#FAF7F2] ${on ? 'bg-[#FAF7F2]' : ''}`}
                >
                  <span className="mt-0.5 w-3 shrink-0 text-[#806A50]">{on ? '✓' : ''}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[#1C1917]">{company.name}</span>
                    {company.hint ? <span className="block truncate text-[10px] text-[#7A7267]">{company.hint}</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {chosen.map((company) => (
        <input key={company.id} type="hidden" name={name} value={company.id} />
      ))}
    </div>
  )
}
