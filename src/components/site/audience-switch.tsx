'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SHOP_MODE_COOKIE, type ShopMode } from '@/lib/catalogue/storefront'

export function AudienceSwitch({
  businessHref,
  hide = false,
}: {
  businessHref: string
  hide?: boolean
}) {
  const pathname = usePathname() || ''
  if (hide) return null
  const corporate = pathname === '/business' || pathname.startsWith('/business/')

  function choose(mode: ShopMode) {
    document.cookie = `${SHOP_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
  }

  const item = (href: string, label: string, active: boolean, mode: ShopMode) => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={() => choose(mode)}
      className={`rounded-sm px-2.5 py-1 ${active ? 'bg-[#382c1e] text-white' : 'text-[#22180b]'}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="inline-flex items-center rounded-sm border border-[#d0c5bb] bg-[#fff1e5] p-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
      {item('/home', 'Retail', !corporate, 'retail')}
      {item(businessHref, 'Business', corporate, 'corporate')}
    </div>
  )
}
