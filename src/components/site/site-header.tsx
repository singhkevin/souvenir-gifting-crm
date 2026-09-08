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
  const [searchOpen, setSearchOpen] = useState(false)
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
    if (!open && !searchOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, searchOpen])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const next = query.trim()
    setFocused(false)
    setSearchOpen(false)
    setOpen(false)
    router.push(next ? `/catalogue?q=${encodeURIComponent(next)}` : '/catalogue')
  }

  return (
    <header className="sticky top-0 z-40">
      {/* Desktop utility bar */}
      <div className="hidden bg-[#1A3022] text-white lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-2.5 lg:px-8">
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
              <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-md border border-[#E8E4DE] bg-white shadow-lg">
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

          <Link href="/home" className="shrink-0 font-serif text-xl tracking-[0.08em] text-white">
            GIFFTER
          </Link>

          <div className="flex shrink-0 items-center gap-4">
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="inline-flex items-center gap-1.5 text-xs text-white/90">
                <User size={14} />
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-white/90">
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
          </div>
        </div>
      </div>

      {/* Main nav / mobile bar */}
      <div className="border-b border-[#E8E4DE] bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/home" className="font-serif text-[1.65rem] tracking-[0.06em] text-[#1B2430] sm:text-2xl">
            GIFFTER
          </Link>

          <nav className="hidden items-center gap-5 text-[13px] text-[#1B2430] lg:flex xl:gap-7">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[#1A3022]">
                {item.label}
              </Link>
            ))}
            {categoryLinks.slice(0, 3).map((item) => (
              <Link key={item.href} href={item.href} className="hidden text-[#5C6570] hover:text-[#1A3022] xl:inline">
                {item.label}
              </Link>
            ))}
            <Link href="/catalogue" className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#1A3022]">
              Shop all
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2 lg:hidden">
            <button
              type="button"
              aria-label="Search catalogue"
              className="flex h-11 w-11 items-center justify-center text-[#1A3022]"
              onClick={() => {
                setSearchOpen(true)
                setOpen(false)
              }}
            >
              <Search size={20} />
            </button>
            <Link
              href="/login"
              className="rounded-sm bg-[#1A3022] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Sign in
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center text-[#1A3022]"
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              onClick={() => {
                setOpen((value) => !value)
                setSearchOpen(false)
              }}
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile search panel */}
        {searchOpen ? (
          <div className="border-t border-[#E8E4DE] bg-white px-4 py-3 lg:hidden">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Search size={18} className="shrink-0 text-[#5C6570]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search gifts, categories, SKUs"
                className="w-full bg-transparent py-2 text-base text-[#1B2430] outline-none placeholder:text-[#8A929C]"
              />
              <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="p-2">
                <X size={18} className="text-[#5C6570]" />
              </button>
            </form>
            {matches.length > 0 ? (
              <div className="mt-2 max-h-56 overflow-y-auto border-t border-[#E8E4DE]">
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="block py-3 text-sm text-[#1B2430]"
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
          </div>
        ) : null}

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-x-0 bottom-0 top-14 z-50 overflow-y-auto border-t border-[#E8E4DE] bg-white px-4 py-6 sm:top-16 lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1">
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[#F0EDE8] py-3.5 text-base text-[#1B2430]"
                >
                  {item.label}
                </Link>
              ))}
              <p className="pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8A929C]">
                Categories
              </p>
              {categoryLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[#F0EDE8] py-3.5 text-base text-[#5C6570]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/request-quote"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center justify-center bg-[#1A3022] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
              >
                Request a Quote
              </Link>
              {workspaceHref && workspaceLabel ? (
                <Link
                  href={workspaceHref}
                  onClick={() => setOpen(false)}
                  className="mt-3 py-3 text-center text-sm text-[#5C6570]"
                >
                  {workspaceLabel}
                </Link>
              ) : (
                <Link href="/login" onClick={() => setOpen(false)} className="mt-3 py-3 text-center text-sm text-[#5C6570]">
                  Account / Team login
                </Link>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  )
}
