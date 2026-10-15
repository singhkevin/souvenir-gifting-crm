'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, User, X } from 'lucide-react'
import { appName } from '@/lib/brand'
import { PwaInstallButton } from '@/components/pwa/pwa-install-button'
import { AudienceSwitch } from '@/components/site/audience-switch'
import { CartDrawer } from '@/components/site/cart-drawer'

const PRIMARY_NAV = [
  { href: '/about', label: 'About' },
  { href: '/catalogue', label: 'Catalogue' },
  { href: '/collections', label: 'Collections' },
  { href: '/categories', label: 'Categories' },
  { href: '/collections#occasions', label: 'Occasions' },
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
  businessHref = '/business',
  hideAudience = false,
  children,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  suggestions?: Suggestion[]
  categoryLinks?: { href: string; label: string }[]
  businessHref?: string
  hideAudience?: boolean
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [corporate, setCorporate] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const mode = document.cookie.split('; ').find((part) => part.startsWith('gf-shop='))
    setCorporate(mode === 'gf-shop=corporate' || pathname.startsWith('/business'))
  }, [pathname])

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
    <header className="sticky top-0 z-40 border-b border-[#d0c5bb] bg-[#fff8f4]">
      <div className="bg-[#fff8f4]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href="/home" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt={appName()} width={196} height={85} className="h-[52px] w-auto sm:h-[60px]" priority />
          </Link>

          <form onSubmit={submitSearch} className="relative hidden min-w-0 flex-1 items-center gap-2 lg:flex">
            <Search size={16} className="shrink-0 text-[#715a3e]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              placeholder="Search gifts, kits, brands"
              className="w-full rounded border border-[#d0c5bb] bg-white px-3 py-2 text-sm text-[#22180b] outline-none placeholder:text-[#7f756d] focus:border-[#715a3e]"
            />
            {focused && matches.length > 0 ? (
              <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-md border border-[#d0c5bb] bg-white shadow-lg">
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="block px-4 py-2.5 text-sm text-[#22180b] hover:bg-[#fff1e5]"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <span className="block font-medium">{item.name}</span>
                    {item.category_name ? (
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-[#715a3e]">
                        {item.category_name}
                      </span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </form>

          <div className="hidden shrink-0 items-center gap-3 lg:flex">
            <AudienceSwitch businessHref={businessHref} hide={hideAudience} />
            <PwaInstallButton />
            {workspaceHref && workspaceLabel ? (
              <Link href={workspaceHref} className="inline-flex items-center gap-1.5 text-xs text-[#22180b]">
                <User size={14} />
                {workspaceLabel}
              </Link>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-[#22180b]">
                <User size={14} />
                Account
              </Link>
            )}
            {corporate ? null : <CartDrawer iconClassName="text-[#22180b]" />}
            <Link
              href="/request-quote"
              className="rounded-sm bg-[#382c1e] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white"
            >
              Quote
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 lg:hidden">
            <PwaInstallButton />
            <button
              type="button"
              aria-label="Search catalogue"
              className="flex h-11 w-11 items-center justify-center text-[#806A50]"
              onClick={() => {
                setSearchOpen(true)
                setOpen(false)
              }}
            >
              <Search size={20} />
            </button>
            {corporate ? null : <CartDrawer iconClassName="text-[#806A50]" />}
            <Link
              href="/login"
              className="rounded-sm bg-[#806A50] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
            >
              Sign in
            </Link>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center text-[#806A50]"
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

        <div className="px-4 pb-2 lg:hidden">
          <AudienceSwitch businessHref={businessHref} hide={hideAudience} />
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
        {children}
        {open ? (
          <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-[#d0c5bb] bg-[#fff8f4] px-4 py-6 lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1">
              <div className="pb-3">
                <AudienceSwitch businessHref={businessHref} hide={hideAudience} />
              </div>
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
                className="mt-6 inline-flex items-center justify-center bg-[#806A50] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
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
