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
    <div className="storefront min-h-screen bg-[#fff8f4] text-[#22180b]">
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
      />
      <header className="sticky top-0 z-40 border-b border-[#eadfd4] bg-[#fff8f4]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <AudienceSwitch businessHref="/business/dashboard" />
            <p className="text-sm text-[#4d453e]">{companyName || 'Business account'}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#735c00]">
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6 lg:px-8">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold ${
                  active ? 'bg-[#22180b] text-white' : 'text-[#4d453e] hover:bg-[#fff1e5]'
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
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
