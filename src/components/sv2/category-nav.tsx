'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Coffee, Droplets, Package, Shirt, Watch } from 'lucide-react'
import type { StoreNavIcon } from '@/lib/catalogue/store-nav'

const ICONS = {
  package: Package,
  coffee: Coffee,
  droplet: Droplets,
  book: BookOpen,
  shirt: Shirt,
  watch: Watch,
} as const

export type CategoryNavItem = { href: string; label: string; icon: StoreNavIcon }

function categoryActive(pathname: string, href: string) {
  const path = href.split('?')[0]
  if (!path || path === '/catalogue' || path === '/business/catalogue') return false
  return pathname === path || pathname.startsWith(`${path}/`)
}

/**
 * SV2 category sub-nav — slim inline row shared by the retail header and the
 * business homepage header. Container matches the header bar above it.
 */
export function CategoryNav({ items }: { items: CategoryNavItem[] }) {
  const pathname = usePathname() || ''

  return (
    <nav aria-label="Shop categories" className="w-full border-t border-[#CCC5BD] bg-[#FCF9F2]">
      <ul className="mx-auto flex h-11 sm:h-12 max-w-7xl items-stretch overflow-x-auto px-4 sm:px-6 lg:px-8 no-scrollbar">
        {items.map((item, index) => {
          const Icon = ICONS[item.icon]
          const active = categoryActive(pathname, item.href)
          return (
            <li key={item.label} className="flex shrink-0 items-stretch">
              {index > 0 ? <span aria-hidden="true" className="my-3 w-px shrink-0 bg-[#CCC5BD]" /> : null}
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`group relative flex items-center gap-2 px-3 sm:px-4 sv2-body-sm whitespace-nowrap transition-colors ${
 active ? 'text-[#000000] font-semibold' : 'text-[#4A4640] hover:text-[#000000]'
 }`}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#9E4300]" />
                <span>{item.label}</span>
                <span
                  className={`absolute inset-x-3 bottom-0 h-0.5 sm:inset-x-4 transition-colors ${
 active ? 'bg-[#9E4300]' : 'bg-transparent group-hover:bg-[#CCC5BD]'
 }`}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
