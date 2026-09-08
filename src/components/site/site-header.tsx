'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Search, User, X } from 'lucide-react'

const PRIMARY_NAV = [
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/collections', label: 'Collections' },
  { href: '/categories', label: 'Categories' },
  { href: '/collections#occasions', label: 'Occasions' },
  { href: '/about', label: 'About' },
]

type Suggestion = {
  id: string
  name: string
  category_name: string | null
  href: string
}

export function SiteHeader({
  workspaceHref,
  workspaceLabel,
  suggestions = [],
  categoryLinks = [],
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  suggestions?: Suggestion[]
  categoryLinks?: { href: string; label: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return suggestions
      .filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          (item.category_name || '').toLowerCase().includes(needle),
      )
      .slice(0, 6)
  }, [query, suggestions])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const next = query.trim()
    setFocused(false)
    setOpen(false)
    router.push(next ? `/catalogue?q=${encodeURIComponent(next)}` : '/catalogue')
  }

  return (
    <header className="sticky top-0 z-40">
      {/* Utility bar — Bombay Store orange → GIFFTER forest */}
      <div className="bg-[#1A3022] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-8">
          <form onSubmit={submitSearch} className="relative flex min-w-0 flex-1 items-center gap-2 max-w-md">
            <Search size={16} className="shrink-0 text-white/80" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              placeholder="Search our catalogue"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/65"
            />
            {focused && matches.length > 0 ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[18rem] overflow-hidden rounded-md border border-[#E8E4DE] bg-white shadow-lg">
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block px-4 py-2.5 text-sm text-[#1B2430] hover:bg-[#F6F4F1]"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <span className="block font-medium">{item.name}</span>
                    {item.category_name ? (
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-[#5C6570]">
                        {item.category_name}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </form>

          <Link href="/home" className="hidden shrink-0 font-serif text-xl tracking-[0.08em] text-white sm:block">
            GIFFTER
          </Link>

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="hidden items-center gap-1.5 text-xs text-white/90 sm:inline-flex">
                <User size={14} />
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="hidden items-center gap-1.5 text-xs text-white/90 sm:inline-flex">
                <User size={14} />
                Account
              </Link>
            )}
            <Link
              href="/request-quote"
              className="rounded-sm bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#1A3022]"
            >
              Quote
            </Link>
            <button
              type="button"
              className="p-1 text-white lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Secondary nav */}
      <div className="border-b border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/home" className="font-serif text-2xl tracking-[0.06em] text-[#1B2430] sm:hidden">
            GIFFTER
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-6 text-[13px] text-[#1B2430] lg:flex xl:gap-8">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[#1A3022]">
                {item.label}
              </Link>
            ))}
            {categoryLinks.slice(0, 4).map((item) => (
              <Link key={item.href} href={item.href} className="hidden text-[#5C6570] hover:text-[#1A3022] xl:inline">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/catalogue" className="hidden text-[12px] font-medium uppercase tracking-[0.12em] text-[#1A3022] lg:inline">
            Shop all
          </Link>
        </div>

        {open ? (
          <div className="border-t border-[#E8E4DE] bg-white px-4 py-5 lg:hidden">
            <nav className="flex flex-col gap-3 text-sm text-[#1B2430]">
              {PRIMARY_NAV.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              ))}
              {categoryLinks.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="text-[#5C6570]">
                  {item.label}
                </Link>
              ))}
              <Link href="/request-quote" onClick={() => setOpen(false)}>
                Request a Quote
              </Link>
              {workspaceHref && workspaceLabel ? (
                <Link href={workspaceHref} onClick={() => setOpen(false)}>
                  {workspaceLabel}
                </Link>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)}>
                  Account
                </Link>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  )
}
