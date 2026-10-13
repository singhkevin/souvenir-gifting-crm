'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AudienceSwitch } from '@/components/site/audience-switch'
import { signOut } from '@/app/login/actions'

const LINKS = [
  { href: '/business/dashboard', label: 'Dashboard' },
  { href: '/business/catalogue', label: 'Catalogue' },
  { href: '/business/quote', label: 'Quote basket' },
  { href: '/business/requests', label: 'Requests' },
  { href: '/business/quotes', label: 'Quotes' },
  { href: '/business/orders', label: 'Orders' },
  { href: '/business/account', label: 'Account' },
]

export function BusinessFrame({
  children,
  companyName,
  verification,
}: {
  children: React.ReactNode
  companyName: string | null
  verification: string | null
}) {
  const pathname = usePathname() || ''

  return (
    <div className="min-h-screen bg-[#F6F4F1] text-[#1B2430]">
      <header className="sticky top-0 z-40 border-b border-[#E8E4DE] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <AudienceSwitch businessHref="/business/dashboard" />
            <p className="text-sm text-[#5C6570]">{companyName || 'Business account'}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-xs uppercase tracking-[0.14em] text-[#806A50]">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs ${
                  active ? 'bg-[#806A50] text-white' : 'text-[#5C6570] hover:bg-[#F6F4F1]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </header>
      {verification !== 'verified' ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Pending approval. You can browse the catalogue. Quote requests open after sales approves this account.
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
