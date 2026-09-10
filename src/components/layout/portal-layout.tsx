'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, PackageSearch, Heart, FileText, ShoppingBag, LayoutDashboard, FolderGit2, Files, ClipboardList } from 'lucide-react';
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

const navItems = [
  { label: 'Dashboard', href: '/portal', icon: LayoutDashboard },
  { label: 'Campaigns', href: '/portal/campaigns', icon: FolderGit2 },
  { label: 'Products', href: '/portal/catalogue', icon: PackageSearch },
  { label: 'Shortlist', href: '/portal/shortlist', icon: Heart },
  { label: 'Requirements', href: '/portal/requirements', icon: ClipboardList },
  { label: 'Quotations', href: '/portal/quotations', icon: FileText },
  { label: 'Orders', href: '/portal/orders', icon: ShoppingBag },
  { label: 'Documents', href: '/portal/documents', icon: Files },
];

const SCROLL_KEY = 'giffter.portal.nav.scrollTop'

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
    <div className="flex min-h-[100dvh] flex-col bg-[#F4EFE6]">
      <header className="sticky top-0 z-50 border-b border-[#E5DFD5] bg-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-serif text-lg font-normal text-white">
                  S
                </div>
                <BrandName className="hidden max-w-[14rem] truncate font-serif text-base tracking-tight text-primary xl:block xl:text-lg" />
              </div>
              
              {/* Full labeled nav only on wide screens to avoid overlap with profile */}
              <nav className="hidden min-w-0 items-center gap-0.5 xl:flex">
                {navItems.map((item) => {
                  const isActive = item.href === '/portal'
                    ? pathname === '/portal'
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-10 items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/5 text-primary'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              {user && (
                <div className="hidden min-w-0 max-w-[10rem] items-center gap-2 border-l border-gray-200 pl-3 lg:flex lg:max-w-[14rem]">
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="truncate text-xs text-gray-500">{user.company_name}</p>
                  </div>
                  <CompanyAvatar name={user.name} logoPath={user.avatar_url} size="md" />
                </div>
              )}
              <button
                onClick={() => signOut()}
                className="hidden h-10 w-10 items-center justify-center rounded-lg border border-[#E5DFD5] text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 xl:inline-flex"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
              
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 xl:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Keep mounted so scroll position persists between opens */}
        <div
          className={`fixed inset-0 top-14 z-40 xl:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}
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
            className={`relative max-h-[calc(100dvh-3.5rem)] overflow-hidden border-b border-gray-200 bg-white shadow-lg transition-transform duration-200 ${
              mobileMenuOpen ? 'translate-y-0' : '-translate-y-2 opacity-0'
            }`}
          >
            <div ref={navRef} className="max-h-[calc(100dvh-3.5rem)] space-y-1 overflow-y-auto overscroll-contain px-2 py-3 sm:px-3">
              {navItems.map((item) => {
                const isActive =
                  item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={isActive ? activeRef : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium ${
                      isActive
                        ? 'bg-primary/5 text-primary'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                    {item.label}
                  </Link>
                );
              })}
              <button
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
                    <div className="truncate text-base font-medium text-gray-800">{user.name}</div>
                    <div className="truncate text-sm font-medium text-gray-500">{user.company_name}</div>
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
