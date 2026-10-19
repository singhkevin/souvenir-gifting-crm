'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, User, X } from 'lucide-react'
import { appName, brandWordmark } from '@/lib/brand'
import { PwaInstallButton } from '@/components/pwa/pwa-install-button'
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
  phone,
  children,
}: {
  workspaceHref?: string | null
  workspaceLabel?: string | null
  suggestions?: Suggestion[]
  categoryLinks?: { href: string; label: string }[]
  businessHref?: string
  hideAudience?: boolean
  phone?: string | null
  children?: React.ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const wordmark = brandWordmark(appName())

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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

  const account = workspaceHref && workspaceLabel ? (
    <Link href={workspaceHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink">
      <User size={16} aria-hidden="true" />
      {workspaceLabel}
    </Link>
  ) : (
    <Link href="/login" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink">
      <User size={16} aria-hidden="true" />
      Account
    </Link>
  )

  return (
    <header
      className={`sticky top-0 z-40 border-b border-cream-border bg-cream-card ${scrolled ? 'shadow-md' : ''}`}
    >
      <div className="hidden h-9 items-center bg-charcoal text-charcoal-muted lg:flex">
        <div className="store-container flex w-full items-center justify-between gap-4 text-xs">
          <p>Curated corporate gifts for teams, clients and brands.</p>
          <div className="flex items-center gap-4">
            {phone ? (
              <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="hover:text-cream">
                {phone}
              </a>
            ) : null}
            {hideAudience ? null : (
              <Link href={businessHref} className="hover:text-cream">
                For Business
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="store-container flex h-16 items-center justify-between gap-3 sm:h-20">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center text-ink lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => {
              setOpen((value) => !value)
              setSearchOpen(false)
            }}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link href="/home" className="flex min-w-0 flex-col leading-none" aria-label={appName()}>
            <span className="font-serif text-[1.45rem] tracking-tight text-ink sm:text-[1.7rem]">{wordmark.lead}</span>
            {wordmark.rest ? (
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-secondary">
                {wordmark.rest}
              </span>
            ) : null}
          </Link>
        </div>

        <form onSubmit={submitSearch} className="relative hidden min-w-0 flex-1 lg:block">
          <label htmlFor="store-search" className="sr-only">
            Search gifts
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
          <input
            id="store-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Search gifts, kits, brands"
            className="h-11 w-full rounded border border-ink-tertiary bg-cream-card pr-3 pl-9 text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
          />
          {focused && matches.length > 0 ? (
            <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded border border-cream-border bg-cream-card shadow-lg">
              {matches.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="block px-4 py-2.5 text-sm text-ink hover:bg-cream-surface"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <span className="block font-medium">{item.name}</span>
                  {item.category_name ? (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-gold-deep">
                      {item.category_name}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}
        </form>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {hideAudience ? null : (
            <Link href={businessHref} className="text-sm text-ink-secondary hover:text-ink">
              For Business
            </Link>
          )}
          <PwaInstallButton />
          {account}
          <CartDrawer iconClassName="text-ink" />
          <Link
            href="/catalogue"
            className="inline-flex h-11 items-center bg-saffron px-4 text-sm font-bold text-charcoal hover:bg-saffron-hover"
          >
            Shop
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            aria-label="Search catalogue"
            className="flex h-11 w-11 items-center justify-center text-ink"
            onClick={() => {
              setSearchOpen(true)
              setOpen(false)
            }}
          >
            <Search size={20} />
          </button>
          <CartDrawer iconClassName="text-ink" />
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-cream-border bg-cream-card px-4 py-3 lg:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2">
            <label htmlFor="store-search-mobile" className="sr-only">
              Search gifts
            </label>
            <Search size={18} className="shrink-0 text-ink-secondary" />
            <input
              id="store-search-mobile"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search gifts, categories, SKUs"
              className="h-12 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-tertiary"
            />
            <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="flex h-11 w-11 items-center justify-center">
              <X size={18} className="text-ink-secondary" />
            </button>
          </form>
          {matches.length > 0 ? (
            <div className="mt-2 max-h-56 overflow-y-auto border-t border-cream-border">
              {matches.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setSearchOpen(false)}
                  className="block py-3 text-sm text-ink"
                >
                  <span className="block font-medium">{item.name}</span>
                  {item.category_name ? (
                    <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-gold-deep">
                      {item.category_name}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {children}

      {open ? (
        <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-cream-border bg-cream-card px-4 py-4 lg:hidden">
          <nav className="store-container flex flex-col px-0">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="min-h-11 border-b border-cream-border py-3 text-base text-ink"
                >
                  {item.label}
                </Link>
              )
            })}
            <p className="store-eyebrow pt-5 pb-2">Categories</p>
            {categoryLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="min-h-11 border-b border-cream-border py-3 text-base text-ink-secondary"
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-4">{account}</div>
            {hideAudience ? null : (
              <Link href={businessHref} onClick={() => setOpen(false)} className="mt-2 min-h-11 py-3 text-sm text-ink-secondary">
                For Business
              </Link>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
