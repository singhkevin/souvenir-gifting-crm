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
      <nav aria-label="Shop categories" className="border-t border-cream-border bg-cream-card">
        <ul className="store-container flex h-14 items-stretch overflow-x-auto px-1 [scrollbar-width:none] sm:h-16 [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = categoryActive(pathname, item.href)
            return (
              <li key={item.label} className="flex shrink-0 items-stretch">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex min-h-11 items-center px-3 text-[13px] whitespace-nowrap sm:px-4 ${
                    active ? 'font-bold text-charcoal' : 'font-semibold text-ink-secondary hover:text-ink'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`absolute inset-x-3 bottom-0 h-0.5 sm:inset-x-4 ${active ? 'bg-saffron' : 'bg-transparent'}`}
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
    <nav aria-label="Shop categories" className="border-t border-cream-border bg-cream">
      <div className="store-container flex gap-3 overflow-x-auto py-3 [scrollbar-width:none] lg:justify-between [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = categoryActive(pathname, item.href)
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`group flex w-[4.75rem] shrink-0 flex-col items-center gap-1.5 sm:w-28 ${
                active ? 'text-charcoal' : 'text-ink'
              }`}
            >
              <span
                className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border bg-cream-card transition-[border-color,transform] duration-150 ease-out group-hover:scale-[1.02] group-hover:border-saffron ${
                  active ? 'border-saffron' : 'border-cream-border'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="line-clamp-2 text-center text-[12px] leading-tight font-semibold sm:text-sm">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
