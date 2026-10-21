'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand/brand-logo'
import { AudienceSwitch } from '@/components/site/audience-switch'
import { CategoryNav, type CategoryNavItem } from '@/components/sv2/category-nav'

interface SV2HeaderProps {
  categories?: CategoryNavItem[]
}

const DEFAULT_CATEGORIES: CategoryNavItem[] = [
  { label: 'Welcome Kits', href: '/catalogue?category=Welcome+Kits', icon: 'package' },
  { label: 'Drinkware', href: '/categories/drinkware', icon: 'coffee' },
  { label: 'Bottles', href: '/categories/bottles', icon: 'droplet' },
  { label: 'Diaries & Desk', href: '/categories/desk-stationery', icon: 'book' },
  { label: 'Apparel', href: '/categories/apparel', icon: 'shirt' },
  { label: 'Watches', href: '/categories/watches', icon: 'watch' },
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
    <header className="sticky top-0 z-40 w-full border-b border-[#CCC5BD] bg-[#FCF9F2]">
      {/* Primary header bar */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-4 sm:gap-6">
          <Link href="/business" className="flex items-center gap-3">
            <BrandLogo priority className="h-7 sm:h-9 w-auto object-contain" />
          </Link>
        </div>

        {/* Desktop Search */}
        <form
          onSubmit={handleSearch}
          className="relative hidden min-w-0 flex-1 max-w-lg items-center lg:flex"
          role="search"
        >
          <Search size={16} className="absolute left-3 shrink-0 text-[#7C766F]" aria-hidden="true" />
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

        {/* Desktop Actions */}
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <AudienceSwitch businessHref="/business" />

          <div className="flex items-center gap-2 sv2-label text-[11px] text-[#4A4640]">
            <Link href="/business/register" className="hover:text-[#1C1C18] transition-colors">
              Register
            </Link>
            <span className="text-[#CCC5BD]" aria-hidden="true">|</span>
            <Link
              href="/login?next=/business/dashboard"
              className="hover:text-[#1C1C18] transition-colors flex items-center gap-1"
            >
              <User size={13} />
              Sign in
            </Link>
          </div>

          {/* Sample Cart */}
          <Link
            href="/business/quote"
            className="flex items-center gap-1.5 border border-[#CCC5BD] px-3 py-2 text-[#1C1C18] hover:border-[#000000] bg-[#F6F3EC] transition-colors"
            title="View Sample Cart"
          >
            <ShoppingBag size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="sv2-label font-semibold text-[11px]">Sample Cart</span>
          </Link>

          {/* Primary CTA: Request a Quote (desktop only; mobile has sticky bottom bar) */}
          <Link
            href="/request-quote"
            className="bg-[#000000] hover:bg-[#9E4300] text-white px-3.5 py-2 sv2-label text-[10px] tracking-wider transition-colors duration-150 active:scale-[0.99] text-center"
          >
            Request a Quote
          </Link>
        </div>

        {/* Mobile Action Cluster */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
          <Link
            href="/login?next=/business/dashboard"
            className="bg-[#000000] px-2.5 py-1.5 sv2-label text-[10px] text-white"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center border border-[#CCC5BD] text-[#1C1C18] bg-[#F6F3EC]"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Category sub-nav — the same component the retail header renders */}
      <CategoryNav items={categories} />

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#CCC5BD] bg-[#FCF9F2] p-4 space-y-4">
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

          <div className="pb-3 border-b border-[#CCC5BD]">
            <AudienceSwitch businessHref="/business" />
          </div>

          <div className="flex flex-col space-y-2">
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
