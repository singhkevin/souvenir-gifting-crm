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
      <nav aria-label="Shop categories" className="border-t border-[#eadfd4] bg-[#fff8f4]">
        <ul className="mx-auto flex h-14 max-w-7xl items-stretch overflow-x-auto px-1 sm:h-16 sm:px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon]
            const active = categoryActive(pathname, item.href)
            return (
              <li key={item.label} className="flex shrink-0 items-stretch">
                {index > 0 ? <span aria-hidden="true" className="my-3.5 w-px shrink-0 bg-[#eadfd4] sm:my-4" /> : null}
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center gap-2 px-3 text-[13px] font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#735c00] sm:px-4 ${
                    active ? 'text-[#22180b]' : 'text-[#3d3228] hover:text-[#22180b]'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#715a3e]" />
                  <span>{item.label}</span>
                  <span
                    className={`absolute inset-x-3 bottom-0 h-0.5 sm:inset-x-4 ${
                      active ? 'bg-[#735c00]' : 'bg-transparent group-hover:bg-[#a68534]'
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
    <nav aria-label="Shop categories" className="border-t border-[#d0c5bb]/80 bg-[#fff8f4]">
      <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-3 py-2.5 sm:gap-3 sm:px-6 lg:justify-between lg:gap-4 lg:px-8">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 rounded border border-[#d0c5bb] bg-white px-1.5 py-2 text-center text-[#22180b] hover:border-[#715a3e] hover:bg-[#fff1e5] sm:w-28 sm:py-2.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#fcebdb] text-[#22180b] sm:h-10 sm:w-10">
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="line-clamp-2 text-[10px] font-semibold leading-tight sm:text-xs">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
