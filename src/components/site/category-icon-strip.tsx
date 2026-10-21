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

function categoryActive(pathname: string, href: string) {
  const path = href.split('?')[0]
  if (!path || path === '/catalogue') return false
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function CategoryIconStrip({
  items,
  variant = 'cards',
}: {
  items: { href: string; label: string; icon: StoreNavIcon }[]
  variant?: 'cards' | 'compact'
}) {
  const pathname = usePathname() || ''

  if (variant === 'compact') {
    return (
      <nav aria-label="Shop categories" className="w-full border-t border-[#CCC5BD] bg-[#FCF9F2]">
        <ul className="mx-auto flex h-11 sm:h-12 max-w-7xl items-stretch overflow-x-auto px-4 sm:px-8 lg:px-16 no-scrollbar">
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

  return (
    <nav aria-label="Shop categories" className="w-full border-t border-[#CCC5BD] bg-[#F6F3EC]">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2.5 sm:gap-3 sm:px-8 lg:px-16 no-scrollbar">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = categoryActive(pathname, item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex w-24 sm:w-28 shrink-0 flex-col items-center gap-1.5 border border-[#CCC5BD] px-2 py-2 text-center transition-colors ${
                active ? 'bg-[#FCF9F2] border-[#000000]' : 'bg-[#FCF9F2] hover:border-[#000000] hover:bg-white'
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center text-[#9E4300]">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="line-clamp-2 sv2-body-sm text-[11px] font-medium leading-tight text-[#1C1C18]">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
