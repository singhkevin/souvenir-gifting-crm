'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/crm/catalogue-setup/homepage', label: 'Homepage' },
  { href: '/crm/catalogue-setup/collections', label: 'Collections' },
]

export function SetupTabs() {
  const pathname = usePathname()
  return (
    <nav className="mt-4 flex gap-1" aria-label="Catalogue setup">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`border px-4 py-2 text-xs font-semibold uppercase tracking-wider ${
              active ? 'border-[#1C1B1A] bg-[#1C1B1A] text-[#FCF9F2]' : 'border-gray-200 text-gray-700 hover:border-[#1C1B1A]'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
