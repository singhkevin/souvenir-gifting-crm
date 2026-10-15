'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SHOP_MODE_COOKIE } from '@/lib/catalogue/storefront'

function businessMode(pathname: string) {
  if (pathname === '/business' || pathname.startsWith('/business/')) return true
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes(`${SHOP_MODE_COOKIE}=corporate`)
}

export function ShopModeGate({
  mode,
  children,
  fallback = null,
}: {
  mode: 'retail' | 'business'
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const pathname = usePathname() || ''
  const [business, setBusiness] = useState(() => pathname === '/business' || pathname.startsWith('/business/'))

  useEffect(() => {
    setBusiness(businessMode(pathname))
  }, [pathname])

  const show = mode === 'business' ? business : !business
  return show ? children : fallback
}
