'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ShoppingBag, User } from 'lucide-react'
import { BUSINESS_QUOTE_KEY, getCartCount, readCart } from '@/lib/catalogue/cart'

/** Square sv2 icon control: cream fill, hairline border, no shadow. */
export const HEADER_ICON_CLASS =
  'relative flex h-9 w-9 shrink-0 items-center justify-center border border-[#CCC5BD] bg-[#F6F3EC] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#1C1B1A]'

/** Square saffron count badge pinned to the top-right of an icon control. */
export function HeaderCountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-[#9E4300] px-1 text-[9px] font-semibold leading-none tabular-nums text-[#FCF9F2]"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

/**
 * Single account control. Signed out it opens sign-in (the sign-in page links
 * to registration); signed in it goes straight to the account / portal.
 */
export function HeaderAccountLink({
  href,
  label,
  onClick,
}: {
  href: string
  label: string
  onClick?: () => void
}) {
  return (
    <Link href={href} onClick={onClick} aria-label={label} title={label} className={HEADER_ICON_CLASS}>
      <User size={17} strokeWidth={1.8} aria-hidden="true" />
    </Link>
  )
}

/** Business quote basket as a bag icon with a count badge. */
export function HeaderSampleCartLink({ href = '/business/quote' }: { href?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const sync = () => setCount(getCartCount(readCart(BUSINESS_QUOTE_KEY)))
    sync()
    window.addEventListener('storage', sync)
    window.addEventListener('giffter-cart-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('giffter-cart-change', sync)
    }
  }, [])

  const label = `Quote basket, ${count} item${count === 1 ? '' : 's'}`
  return (
    <Link href={href} aria-label={label} title="Quote basket" className={HEADER_ICON_CLASS}>
      <ShoppingBag size={17} strokeWidth={1.8} aria-hidden="true" />
      <HeaderCountBadge count={count} />
    </Link>
  )
}

/** Icon-only submit button that sits inside the header search field. */
export function HeaderSearchSubmit() {
  return (
    <button
      type="submit"
      aria-label="Search"
      title="Search"
      className="absolute right-0 top-0 flex h-full w-10 items-center justify-center text-[#4A4640] transition-colors hover:text-[#9E4300]"
    >
      <Search size={16} strokeWidth={1.9} aria-hidden="true" />
    </button>
  )
}

export const HEADER_SEARCH_PLACEHOLDER = 'Search gifts, SKUs, occasions'
