'use client'

import Image from 'next/image'
import Link from 'next/link'
import { appName } from '@/lib/brand'
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
    <div className="min-h-screen bg-[#FCF9F2] text-[#1C1C18]">
      <header className="sticky top-0 z-40 border-b border-[#CCC5BD] bg-[#FCF9F2]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/business/dashboard"
              className="flex items-center"
            >
              <Image src="/logo.png" alt={appName()} width={140} height={44} className="h-7 w-auto object-contain sm:h-8" priority />
            </Link>
            <span className="hidden sm:inline-block h-4 w-px bg-[#CCC5BD]" />
            <AudienceSwitch businessHref="/business/dashboard" />
            {companyName ? (
              <span className="inline-flex items-center gap-1.5 border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-1 text-xs text-[#4A4640]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" />
                <span className="font-medium text-[#1C1C18]">{companyName}</span>
              </span>
            ) : (
              <span className="text-xs text-[#4A4640]">Business account</span>
            )}
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="border border-[#CCC5BD] bg-[#FCF9F2] px-3 py-1.5 sv2-label text-[10px] text-[#4A4640] hover:border-[#1C1C18] hover:text-[#1C1C18] transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto no-scrollbar border-t border-[#CCC5BD] px-4 py-2 sm:px-6">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap px-3 py-1.5 sv2-label text-[10px] sm:text-[11px] transition-colors ${
                  active
                    ? 'bg-[#000000] text-[#FCF9F2]'
                    : 'text-[#4A4640] hover:bg-[#F6F3EC] hover:text-[#1C1C18]'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      </header>
      {verification !== 'verified' ? (
        <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-2.5 text-xs text-[#9E4300] sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF8843] animate-pulse" />
            <span>Pending approval. You can browse the catalogue. Quote requests open after sales approves this account.</span>
          </div>
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

