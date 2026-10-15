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
}: {
  items: { href: string; label: string; icon: StoreNavIcon }[]
}) {
  const pathname = usePathname() || ''

  return (
      <nav aria-label="Shop categories" className="border-t border-[#eadfd4] bg-[#fff8f4]">
        <ul className="mx-auto flex h-14 max-w-7xl items-stretch overflow-x-auto px-4 sm:h-16 sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item, index) => {
            const Icon = ICONS[item.icon]
            const active = categoryActive(pathname, item.href)
            return (
              <li key={item.label} className="flex shrink-0 items-stretch lg:min-w-0 lg:flex-1">
                {index > 0 ? <span aria-hidden="true" className="my-3.5 w-px shrink-0 bg-[#eadfd4] sm:my-4" /> : null}
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex flex-1 items-center justify-center gap-2 px-4 text-[13px] font-medium whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#735c00] lg:px-2 ${
                    active ? 'text-[#22180b]' : 'text-[#3d3228] hover:text-[#22180b]'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[#715a3e]" />
                  <span>{item.label}</span>
                  <span
                    className={`absolute inset-x-4 bottom-0 h-0.5 lg:inset-x-2 ${
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
