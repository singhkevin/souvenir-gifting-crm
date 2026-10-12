'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AudienceSwitch({
  businessHref,
  hide = false,
}: {
  businessHref: string
  hide?: boolean
}) {
  const pathname = usePathname() || ''
  if (hide) return null
  const business = pathname === '/business' || pathname.startsWith('/business/')

  const item = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-sm px-2.5 py-1 ${active ? 'bg-[#241C12] text-white' : 'text-[#241C12]'}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="inline-flex items-center rounded-sm border border-[#241C12]/25 p-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
      {item('/home', 'Shop', !business)}
      {item(businessHref, 'For Business', business)}
    </div>
  )
}
