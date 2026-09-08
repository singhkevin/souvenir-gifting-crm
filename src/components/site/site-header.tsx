'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'

const NAV = [
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/collections', label: 'Collections' },
  { href: '/categories', label: 'Categories' },
  { href: '/collections', label: 'Occasions', hash: 'occasions' },
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
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  suggestions?: Suggestion[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return suggestions.slice(0, 6)
    return suggestions
      .filter(
        (item) =>
          item.name.toLowerCase().includes(needle) ||
          (item.category_name || '').toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [query, suggestions])

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const next = query.trim()
    setSearchOpen(false)
    setOpen(false)
    router.push(next ? `/catalogue?q=${encodeURIComponent(next)}` : '/catalogue')
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-[height,background-color,box-shadow,border-color] duration-300 ${
          scrolled
            ? 'border-b border-[#E2DBD0]/90 bg-[#F7F4EF]/95 shadow-[0_8px_30px_rgba(28,25,23,0.05)] backdrop-blur-md'
            : 'border-b border-transparent bg-[#F7F4EF]/80 backdrop-blur-sm'
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8 ${
            scrolled ? 'h-14' : 'h-16 sm:h-[4.5rem]'
          }`}
        >
          <Link href="/home" className="font-serif text-xl tracking-tight text-[#1C1917] sm:text-2xl">
            GIFFTER
          </Link>

          <nav className="hidden items-center gap-7 text-[11px] font-medium uppercase tracking-[0.18em] text-[#3F3A34] lg:flex">
            <Link href="/catalogue" className="hover:text-[#1A3022]">
              Catalogue
            </Link>
            <Link href="/collections" className="hover:text-[#1A3022]">
              Collections
            </Link>
            <Link href="/categories" className="hover:text-[#1A3022]">
              Categories
            </Link>
            <Link href="/collections#occasions" className="hover:text-[#1A3022]">
              Occasions
            </Link>
          </nav>

          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              aria-label="Search catalogue"
              onClick={() => setSearchOpen(true)}
              className="p-1.5 text-[#1A3022]"
            >
              <Search size={18} />
            </button>
            <Link
              href="/request-quote"
              className="hidden bg-[#1A3022] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#F7F2EA] sm:inline"
            >
              Request a Quote
            </Link>
            {workspaceHref && workspaceLabel ? (
              <Link
                href={workspaceHref}
                className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-[#3F3A34] lg:inline"
              >
                {workspaceLabel}
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden text-[11px] font-medium uppercase tracking-[0.16em] text-[#3F3A34] lg:inline"
              >
                Team login
              </Link>
            )}
            <button
              type="button"
              className="p-1.5 text-[#1A3022] lg:hidden"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="border-t border-[#E2DBD0] bg-[#F7F4EF] px-5 py-6 lg:hidden">
            <nav className="flex flex-col gap-4 text-sm uppercase tracking-[0.16em] text-[#3F3A34]">
              {NAV.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.hash ? `${item.href}#${item.hash}` : item.href}
                  onClick={() => setOpen(false)}
                >
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
                  Team login
                </Link>
              )}
            </nav>
          </div>
        )}
      </header>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#1A3022]/55 px-4 pt-[12vh] backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden border border-[#C9C0B2] bg-[#EFE8DC] shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
            <form onSubmit={submitSearch} className="flex items-center gap-3 border-b border-[#C9C0B2] px-5 py-4">
              <Search size={18} className="text-[#3F3A34]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search gifts, categories, SKUs…"
                className="w-full bg-transparent text-base text-[#1C1917] outline-none placeholder:text-[#6B6358]"
              />
              <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="p-1">
                <X size={18} className="text-[#3F3A34]" />
              </button>
            </form>
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {matches.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[#3F3A34]">No matching gifts. Press Enter to search the catalogue.</p>
              ) : (
                matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-[#C9C0B2]"
                  >
                    <span>
                      <span className="block text-sm text-[#1C1917]">{item.name}</span>
                      {item.category_name ? (
                        <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-[#3F3A34]">
                          {item.category_name}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#1A3022]">View →</span>
                  </Link>
                ))
              )}
            </div>
            <div className="border-t border-[#C9C0B2] px-5 py-3 text-[11px] uppercase tracking-[0.14em] text-[#3F3A34]">
              Enter to open full catalogue results
            </div>
          </div>
        </div>
      )}
    </>
  )
}
