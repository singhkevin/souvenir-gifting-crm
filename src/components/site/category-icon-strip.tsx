import Link from 'next/link'
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

export function CategoryIconStrip({
  items,
}: {
  items: { href: string; label: string; icon: StoreNavIcon }[]
}) {
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
