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

  const item = (href: string, label: string, active: boolean, mode: ShopMode) => {
    if (active) {
      return (
        <span
          aria-current="page"
          className="px-2.5 sm:px-3 py-1 sv2-label text-[10px] sm:text-[11px] bg-[#000000] text-[#FCF9F2]"
        >
          {label}
        </span>
      )
    }

    return (
      <Link
        href={href}
        onClick={() => choose(mode)}
        className="px-2.5 sm:px-3 py-1 sv2-label text-[10px] sm:text-[11px] text-[#4A4640] hover:text-[#1C1C18] transition-colors"
      >
        {label}
      </Link>
    )
  }

  return (
    <div
      className="inline-flex items-center border border-[#CCC5BD] p-0.5 bg-[#F6F3EC]"
      role="group"
      aria-label="Store mode selector"
    >
      {item('/home', 'Retail', !corporate, 'retail')}
      {item(businessHref, 'Business', corporate, 'corporate')}
    </div>
  )
}
