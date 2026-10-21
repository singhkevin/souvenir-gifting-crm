'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, PackageSearch, Heart, FileText, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { BrandName } from '@/components/brand/brand-name';
import { signOut } from '@/app/login/actions';
import { CompanyAvatar } from '../ui/avatar';

interface PortalLayoutProps {
  children: React.ReactNode;
  user?: {
    name: string;
    company_name: string;
    avatar_url?: string;
  };
}

type PortalNavItem = {
  label: string;
  shortLabel?: string;
  href: string;
  icon: typeof LayoutDashboard;
  active: (pathname: string) => boolean;
};

const navItems: PortalNavItem[] = [
  {
    label: 'Home',
    href: '/portal',
    icon: LayoutDashboard,
    active: (pathname) => pathname === '/portal' || pathname === '/portal/dashboard',
  },
  {
    label: 'Gifts',
    href: '/portal/gifts',
    icon: PackageSearch,
    active: (pathname) =>
      pathname.startsWith('/portal/gifts') ||
      pathname.startsWith('/portal/catalogue') ||
      pathname.startsWith('/portal/catalogs'),
  },
  {
    label: 'Quote basket',
    href: '/portal/quote-basket',
    icon: Heart,
    active: (pathname) => pathname.startsWith('/portal/quote-basket') || pathname.startsWith('/portal/shortlist'),
  },
  {
    label: 'Quotes & requests',
    shortLabel: 'Quotes',
    href: '/portal/quotes',
    icon: FileText,
    active: (pathname) =>
      pathname.startsWith('/portal/quotes') ||
      pathname.startsWith('/portal/requirements') ||
      pathname.startsWith('/portal/quotations'),
  },
  {
    label: 'Orders',
    href: '/portal/orders',
    icon: ShoppingBag,
    active: (pathname) => pathname.startsWith('/portal/orders'),
  },
];

const SCROLL_KEY = 'giffter.portal.nav.scrollTop'

function linkClass(active: boolean) {
  return `inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors xl:px-2.5 min-[1440px]:px-3 min-[1440px]:text-sm ${
    active ? 'bg-primary/5 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
  }`
}

export function PortalLayout({ children, user }: PortalLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLAnchorElement | null>(null)

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const saved = Number.parseInt(sessionStorage.getItem(SCROLL_KEY) || '', 10)
    if (Number.isFinite(saved) && saved > 0) nav.scrollTop = saved
    if (mobileMenuOpen) {
      requestAnimationFrame(() => {
        activeRef.current && (() => {
          const nav = navRef.current
          const el = activeRef.current
          if (!nav || !el) return
          const navRect = nav.getBoundingClientRect()
          const elRect = el.getBoundingClientRect()
          if (elRect.top < navRect.top) nav.scrollTop -= navRect.top - elRect.top
          else if (elRect.bottom > navRect.bottom) nav.scrollTop += elRect.bottom - navRect.bottom
        })()
      })
    }
  }, [pathname, mobileMenuOpen])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(nav.scrollTop))
    nav.addEventListener('scroll', onScroll, { passive: true })
    return () => nav.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="portal-client flex min-h-[100dvh] flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-[#E5DFD5] bg-white">
        <div className="grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 px-3 sm:h-16 sm:gap-x-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary font-serif text-lg font-normal text-[#FFFFFF]">
              S
            </div>
            <BrandName className="block max-w-[6.5rem] truncate text-sm tracking-tight text-primary sm:max-w-[9rem] lg:max-w-[8rem] xl:max-w-[11rem] xl:text-base min-[1440px]:max-w-[18rem] min-[1440px]:text-lg" />
          </div>

          <nav aria-label="Portal" className="hidden min-w-0 items-center gap-0.5 lg:flex xl:gap-1">
            {navItems.map((item) => {
              const active = item.active(pathname)
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-primary' : 'text-gray-400'}`} />
                  {item.shortLabel ? (
                    <>
                      <span className="whitespace-nowrap xl:hidden">{item.shortLabel}</span>
                      <span className="hidden whitespace-nowrap xl:inline">{item.label}</span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {user ? (
              <div className="hidden min-w-0 items-center gap-2 border-l border-gray-200 pl-2 lg:flex">
                <div className="min-w-0 max-w-[5.5rem] text-right xl:max-w-[8rem] min-[1440px]:max-w-[12rem]">
                  <p className="truncate text-sm font-medium leading-tight text-gray-900" title={user.name}>{user.name}</p>
                  <p className="truncate text-xs leading-tight text-gray-500" title={user.company_name}>{user.company_name}</p>
                </div>
                <CompanyAvatar name={user.name} logoPath={user.avatar_url} size="md" />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => signOut()}
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-[#E5DFD5] text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 lg:inline-flex"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="portal-nav-drawer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div
          id="portal-nav-drawer"
          className={`fixed inset-0 top-14 z-40 sm:top-16 lg:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}
          aria-hidden={!mobileMenuOpen}
        >
          <button
            type="button"
            tabIndex={mobileMenuOpen ? 0 : -1}
            className={`absolute inset-0 bg-black/30 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className={`relative max-h-[calc(100dvh-3.5rem)] overflow-hidden border-b border-gray-200 bg-white shadow-lg transition-transform duration-200 sm:max-h-[calc(100dvh-4rem)] ${
              mobileMenuOpen ? 'translate-y-0' : '-translate-y-2 opacity-0'
            }`}
          >
            <div ref={navRef} className="max-h-[calc(100dvh-3.5rem)] space-y-1 overflow-y-auto overscroll-contain px-2 py-3 sm:max-h-[calc(100dvh-4rem)] sm:px-3">
              {navItems.map((item) => {
                const active = item.active(pathname)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={active ? activeRef : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium ${
                      active ? 'bg-primary/5 text-primary' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                )
              })}
              <button
                type="button"
                onClick={() => signOut()}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
              {user ? (
                <div className="mt-2 flex items-center gap-3 border-t border-gray-200 px-3 py-4">
                  <CompanyAvatar name={user.name} logoPath={user.avatar_url} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-gray-800" title={user.name}>{user.name}</div>
                    <div className="truncate text-sm font-medium text-gray-500" title={user.company_name}>{user.company_name}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
