'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, Search, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { PwaInstallButton } from '@/components/pwa/pwa-install-button'
import { AudienceSwitch } from '@/components/site/audience-switch'
import { CartDrawer } from '@/components/site/cart-drawer'
import {
  HEADER_ICON_CLASS,
  HEADER_SEARCH_PLACEHOLDER,
  HeaderAccountLink,
  HeaderSampleCartLink,
  HeaderSearchSubmit,
} from '@/components/sv2/header-actions'
import { ProductThumb } from '@/components/ui/product-thumb'

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
  image_url?: string | null
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
  const signedIn = Boolean(workspaceHref && workspaceLabel)
  const accountHref = signedIn ? (workspaceHref as string) : '/login'
  const accountLabel = signedIn ? (workspaceLabel as string) : 'Sign in or register'

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
    <header className="sticky top-0 z-40 w-full border-b border-[#CCC5BD] bg-[#FCF9F2]">
      <div className="bg-[#FCF9F2]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-4 sm:gap-6">
            <Link href="/home" className="flex items-center gap-3">
              <BrandLogo priority className="h-7 sm:h-9 w-auto object-contain" />
            </Link>
          </div>

          {/* Desktop Search */}
          <form onSubmit={submitSearch} className="relative hidden min-w-0 flex-1 max-w-lg items-center lg:flex" role="search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              placeholder={HEADER_SEARCH_PLACEHOLDER}
              aria-label="Search the catalogue"
              className="w-full bg-[#F6F3EC] border border-[#CCC5BD] pl-3 pr-10 py-2 sv2-body-sm text-[#1C1C18] focus:outline-none focus:border-[#000000] placeholder:text-[#7C766F]"
            />
            <HeaderSearchSubmit />
            {focused && matches.length > 0 ? (
              <div className="absolute left-0 top-full z-50 mt-1 w-full border border-[#CCC5BD] bg-[#FCF9F2] shadow-none">
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#1C1C18] hover:bg-[#F6F3EC] border-b border-[#CCC5BD]/40 last:border-0"
                    onMouseDown={(event) => event.preventDefault()}
                  >
                    <ProductThumb src={item.image_url} alt={item.name} />
                    <span className="min-w-0">
                      <span className="block font-medium">{item.name}</span>
                      {item.category_name ? (
                        <span className="mt-0.5 block sv2-label text-[10px] text-[#9E4300]">
                          {item.category_name}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </form>

          {/* Desktop Actions */}
          <div className="hidden shrink-0 items-center gap-2 lg:flex">
            <AudienceSwitch businessHref={businessHref} hide={hideAudience} />
            <PwaInstallButton iconOnly />
            <HeaderAccountLink href={accountHref} label={accountLabel} />
            {corporate ? <HeaderSampleCartLink /> : <CartDrawer iconClassName="text-[#1C1C18]" />}
            <Link
              href="/request-quote"
              className="bg-[#000000] hover:bg-[#9E4300] text-white px-3.5 py-2 sv2-label text-[10px] tracking-wider transition-colors duration-150 active:scale-[0.99] text-center"
            >
              Request a Quote
            </Link>
          </div>

          {/* Mobile Action Cluster */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
            <div className="hidden sm:block">
              <PwaInstallButton iconOnly />
            </div>
            <button
              type="button"
              aria-label="Search catalogue"
              title="Search"
              className={HEADER_ICON_CLASS}
              onClick={() => {
                setSearchOpen(true)
                setOpen(false)
              }}
            >
              <Search size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <HeaderAccountLink href={accountHref} label={accountLabel} />
            {corporate ? <HeaderSampleCartLink /> : <CartDrawer iconClassName="text-[#1C1C18]" />}
            <button
              type="button"
              className={HEADER_ICON_CLASS}
              aria-label={open ? 'Close menu' : 'Open menu'}
              title={open ? 'Close menu' : 'Menu'}
              aria-expanded={open}
              onClick={() => {
                setOpen((value) => !value)
                setSearchOpen(false)
              }}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile search panel */}
        {searchOpen ? (
          <div className="border-t border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3 lg:hidden">
            <form onSubmit={submitSearch} className="flex items-center gap-2">
              <Search size={18} className="shrink-0 text-[#7C766F]" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={HEADER_SEARCH_PLACEHOLDER}
                aria-label="Search the catalogue"
                className="w-full bg-transparent py-2 sv2-body-sm text-[#1C1C18] outline-none placeholder:text-[#7C766F]"
              />
              <button type="button" aria-label="Close search" title="Close search" onClick={() => setSearchOpen(false)} className="p-1.5 text-[#7C766F]">
                <X size={18} />
              </button>
            </form>
            {matches.length > 0 ? (
              <div className="mt-2 max-h-56 overflow-y-auto border-t border-[#CCC5BD]">
                {matches.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setSearchOpen(false)}
                    className="flex items-center gap-3 py-2.5 sv2-body-sm text-[#1C1C18] border-b border-[#CCC5BD]/40 last:border-0"
                  >
                    <ProductThumb src={item.image_url} alt={item.name} />
                    <span className="min-w-0">
                      <span className="block font-medium">{item.name}</span>
                      {item.category_name ? (
                        <span className="mt-0.5 block sv2-label text-[10px] text-[#9E4300]">
                          {item.category_name}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Category bar or subnav children */}
        {children}

        {/* Mobile drawer */}
        {open ? (
          <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto border-t border-[#CCC5BD] bg-[#FCF9F2] px-4 py-6 lg:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1">
              <div className="pb-3 border-b border-[#CCC5BD]">
                <AudienceSwitch businessHref={businessHref} hide={hideAudience} />
              </div>
              {PRIMARY_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[#CCC5BD]/50 py-3 sv2-body-md text-[#1C1C18] hover:text-[#9E4300] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <p className="pb-2 pt-4 sv2-label text-[#7C766F]">
                Categories
              </p>
              {categoryLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[#CCC5BD]/30 py-2.5 sv2-body-sm text-[#4A4640] hover:text-[#1C1C18] transition-colors"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/request-quote"
                onClick={() => setOpen(false)}
                className="mt-6 inline-flex items-center justify-center bg-[#000000] hover:bg-[#9E4300] px-5 py-3 sv2-label text-white tracking-wider transition-colors"
              >
                Request a Quote
              </Link>
              {workspaceHref && workspaceLabel ? (
                <Link
                  href={workspaceHref}
                  onClick={() => setOpen(false)}
                  className="mt-3 py-2.5 text-center sv2-body-sm text-[#4A4640]"
                >
                  {workspaceLabel}
                </Link>
              ) : (
                <div className="mt-3 flex items-center justify-center gap-3 py-2 sv2-label text-[#4A4640]">
                  <Link href="/signup" onClick={() => setOpen(false)} className="hover:text-[#1C1C18]">
                    Register
                  </Link>
                  <span className="text-[#CCC5BD]" aria-hidden="true">|</span>
                  <Link href="/login" onClick={() => setOpen(false)} className="hover:text-[#1C1C18]">
                    Sign in
                  </Link>
                </div>
              )}
              <div className="mt-3 flex justify-center sm:hidden">
                <PwaInstallButton />
              </div>
            </nav>
          </div>
        ) : null}
      </div>
    </header>
  )
}
