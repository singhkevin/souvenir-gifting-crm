'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { appName } from '@/lib/brand'

interface SV2HeaderProps {
  categories?: Array<{ label: string; href: string }>
}

const DEFAULT_CATEGORIES = [
  { label: 'Welcome Kits', href: '/catalogue?category=Welcome+Kits' },
  { label: 'Drinkware', href: '/categories/drinkware' },
  { label: 'Bottles', href: '/categories/bottles' },
  { label: 'Diaries & Desk', href: '/categories/desk-stationery' },
  { label: 'Apparel', href: '/categories/apparel' },
  { label: 'Watches', href: '/categories/watches' },
  { label: 'Festive Hampers', href: '/collections/festival-gifting' },
]

export function SV2Header({ categories = DEFAULT_CATEGORIES }: SV2HeaderProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/catalogue?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="w-full max-w-full min-w-0 border-b border-[#CCC5BD] bg-[#FCF9F2] sticky top-0 z-50">
      {/* Primary header bar */}
      <div className="w-full max-w-full min-w-0 px-4 sm:px-8 lg:px-16 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 lg:gap-6">
        {/* Brand logo */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <Link href="/business" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt={appName()}
              width={140}
              height={44}
              className="h-7 sm:h-9 w-auto object-contain"
              priority
            />
          </Link>
          <span className="hidden xl:inline-block border-l border-[#CCC5BD] pl-4 sv2-label text-[10px] text-[#4A4640]">
            CORPORATE GIFTING // IN
          </span>
        </div>

        {/* Center Search Bar with SKU Hint */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-lg items-center relative"
          role="search"
        >
          <svg
            className="absolute left-3 w-4 h-4 text-[#7C766F]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by catalogue SKU, occasion, or product name..."
            className="w-full bg-[#F6F3EC] border border-[#CCC5BD] pl-10 pr-20 py-2 sv2-body-sm text-[#1C1C18] focus:outline-none focus:border-[#000000] placeholder:text-[#7C766F]"
          />
          <span
            className="absolute right-3 sv2-label text-[#7C766F] border border-[#CCC5BD] px-1.5 py-0.5 bg-[#FCF9F2] text-[10px]"
            aria-hidden="true"
          >
            SEARCH
          </span>
        </form>

        {/* Actions & Switcher */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Segmented Switcher: Retail | Business */}
          <div
            className="flex items-center border border-[#CCC5BD] p-0.5 bg-[#F6F3EC]"
            role="group"
            aria-label="Store mode selector"
          >
            <Link
              href="/"
              className="px-2 sm:px-3 py-1 sv2-label text-[10px] sm:text-[11px] text-[#4A4640] hover:text-[#1C1C18] transition-colors"
            >
              Retail
            </Link>
            <span
              aria-current="page"
              className="px-2 sm:px-3 py-1 sv2-label text-[10px] sm:text-[11px] bg-[#000000] text-[#FCF9F2]"
            >
              Business
            </span>
          </div>

          {/* Account links */}
          <div className="hidden lg:flex items-center gap-2.5">
            <Link
              href="/business/register"
              className="sv2-label text-[11px] text-[#4A4640] hover:text-[#1C1C18] transition-colors"
            >
              Register
            </Link>
            <span className="text-[#CCC5BD]" aria-hidden="true">|</span>
            <Link
              href="/login?next=/business/dashboard"
              className="sv2-label text-[11px] text-[#4A4640] hover:text-[#1C1C18] transition-colors"
            >
              Sign in
            </Link>
          </div>

          {/* Sample Cart */}
          <Link
            href="/business/quote"
            className="hidden sm:flex items-center gap-1.5 border border-[#CCC5BD] px-3 py-2 text-[#1C1C18] hover:border-[#000000] bg-transparent transition-colors"
            title="View Sample Cart"
          >
            <svg
              className="w-4 h-4 text-[#1C1C18]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span className="sv2-label font-semibold text-[11px]">Sample Cart</span>
          </Link>

          {/* Primary CTA: Request a Quote (desktop only; mobile has sticky bottom bar) */}
          <Link
            href="/request-quote"
            className="hidden sm:inline-block bg-[#000000] hover:bg-[#9E4300] text-white px-3.5 sm:px-5 py-2 sm:py-2.5 sv2-label text-[10px] sm:text-[11px] tracking-wider transition-colors duration-150 active:scale-[0.99] text-center"
          >
            Request a Quote
          </Link>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 border border-[#CCC5BD] text-[#1C1C18]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Secondary Category Navigation Links (horizontal scrollable, no duplicate status note) */}
      <div className="w-full max-w-full min-w-0 border-t border-[#CCC5BD] px-4 sm:px-8 lg:px-16">
        <nav
          className="w-full max-w-full min-w-0 overflow-x-auto flex items-center py-2.5 no-scrollbar"
          aria-label="Categories"
        >
          <div className="flex items-center space-x-6 min-w-max">
            {categories.map((cat, idx) => (
              <Link
                key={cat.href}
                href={cat.href}
                className={`sv2-body-sm transition-colors duration-150 hover:text-[#000000] whitespace-nowrap ${
                  idx === 0
                    ? 'border-b-2 border-[#9E4300] text-[#000000] font-semibold pb-1'
                    : 'text-[#4A4640] pb-1'
                }`}
              >
                {cat.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#CCC5BD] bg-[#FCF9F2] p-4 space-y-4">
          <form onSubmit={handleSearch} className="flex items-center relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalogue..."
              className="w-full bg-[#F6F3EC] border border-[#CCC5BD] px-3 py-2 sv2-body-sm text-[#1C1C18]"
            />
            <button
              type="submit"
              className="ml-2 bg-[#000000] text-white px-3 py-2 sv2-label text-[10px]"
            >
              Go
            </button>
          </form>

          <div className="flex flex-col space-y-2 pt-2 border-t border-[#CCC5BD]">
            <Link
              href="/business/register"
              className="sv2-body-sm text-[#1C1C18] py-1 flex items-center justify-between"
            >
              <span>Register Business Account</span>
              <span className="text-[#9E4300] font-semibold">→</span>
            </Link>
            <Link
              href="/login?next=/business/dashboard"
              className="sv2-body-sm text-[#1C1C18] py-1 flex items-center justify-between"
            >
              <span>Sign In</span>
              <span className="text-[#9E4300] font-semibold">→</span>
            </Link>
            <Link
              href="/business/quote"
              className="sv2-body-sm text-[#1C1C18] py-1 flex items-center justify-between"
            >
              <span>Sample Cart</span>
              <span className="text-[#9E4300] font-semibold">→</span>
            </Link>
            <Link
              href="/catalogue"
              className="sv2-body-sm text-[#1C1C18] py-1 flex items-center justify-between"
            >
              <span>Full Corporate Catalogue</span>
              <span className="text-[#9E4300] font-semibold">→</span>
            </Link>
            <Link
              href="/request-quote"
              className="sv2-body-sm text-[#1C1C18] py-1 flex items-center justify-between"
            >
              <span>Request a Quotation</span>
              <span className="text-[#9E4300] font-semibold">→</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
