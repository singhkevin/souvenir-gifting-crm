'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, PackageSearch, Heart, FileText, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { CompanyAvatar } from '../ui/avatar';
import { BrandLogo } from '@/components/brand/brand-logo';

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

const SCROLL_KEY = 'giffter.portal.nav.scrollTop';

export function PortalLayout({ children, user }: PortalLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

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
    const nav = navRef.current;
    if (!nav) return;
    const saved = Number.parseInt(sessionStorage.getItem(SCROLL_KEY) || '', 10);
    if (Number.isFinite(saved) && saved > 0) nav.scrollTop = saved;
    if (mobileMenuOpen) {
      requestAnimationFrame(() => {
        activeRef.current && (() => {
          const el = activeRef.current;
          if (!nav || !el) return;
          const navRect = nav.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          if (elRect.top < navRect.top) nav.scrollTop -= navRect.top - elRect.top;
          else if (elRect.bottom > navRect.bottom) nav.scrollTop += elRect.bottom - navRect.bottom;
        })();
      });
    }
  }, [pathname, mobileMenuOpen]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(nav.scrollTop));
    nav.addEventListener('scroll', onScroll, { passive: true });
    return () => nav.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#FCF9F2] text-[#1C1C18]">
      {/* Sticky Cream Header */}
      <header className="sticky top-0 z-50 border-b border-[#CCC5BD] bg-[#FCF9F2]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          {/* Co-branded wordmark: brand + divider + Company Name */}
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link href="/portal" className="flex min-w-0 items-center gap-2.5 sm:gap-3 transition-opacity hover:opacity-90">
              <BrandLogo className="h-7 w-auto shrink-0 object-contain sm:h-9" />
              <span className="h-4 w-px shrink-0 bg-[#CCC5BD]" aria-hidden="true" />
              <span className="max-w-[110px] truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F] sm:max-w-[180px] md:max-w-[240px] min-[1440px]:max-w-[320px]">
                {user?.company_name || 'Your Company'}
              </span>
            </Link>
          </div>

          {/* Nav links: Jakarta 14px with active one underlined/black, saffron accents */}
          <nav aria-label="Portal" className="hidden min-w-0 items-center gap-4 lg:flex xl:gap-6">
            {navItems.map((item) => {
              const active = item.active(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`group inline-flex shrink-0 items-center gap-1.5 border-b-2 py-1 font-[family-name:var(--font-jakarta)] text-[14px] leading-5 transition-colors ${
                    active
                      ? 'border-[#1C1C18] font-semibold text-[#1C1C18]'
                      : 'border-transparent text-[#4A4640] hover:text-[#9E4300]'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active ? 'text-[#9E4300]' : 'text-[#7C766F] group-hover:text-[#9E4300]'
                    }`}
                  />
                  {item.shortLabel ? (
                    <>
                      <span className="whitespace-nowrap xl:hidden">{item.shortLabel}</span>
                      <span className="hidden whitespace-nowrap xl:inline">{item.label}</span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Header: User info, Logout, Mobile toggle */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {user ? (
              <div className="hidden min-w-0 items-center gap-3 border-l border-[#CCC5BD] pl-3 sm:flex">
                <div className="min-w-0 max-w-[6rem] text-right xl:max-w-[10rem]">
                  <p className="truncate sv2-label text-[11px] text-[#1C1C18]" title={user.name}>
                    {user.name}
                  </p>
                  <p
                    className="truncate font-[family-name:var(--font-mono)] text-[10px] text-[#7C766F]"
                    title={user.company_name}
                  >
                    {user.company_name}
                  </p>
                </div>
                <CompanyAvatar
                  name={user.name}
                  logoPath={user.avatar_url}
                  size="md"
                  className="rounded-none border border-[#CCC5BD]"
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => signOut()}
              className="hidden h-9 w-9 items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent text-[#4A4640] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC] hover:text-[#BA1A1A] lg:inline-flex"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent text-[#1C1C18] transition-colors hover:bg-[#F6F3EC] lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-controls="portal-nav-drawer"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          id="portal-nav-drawer"
          className={`fixed inset-0 top-14 z-40 sm:top-16 lg:hidden ${mobileMenuOpen ? '' : 'pointer-events-none'}`}
          aria-hidden={!mobileMenuOpen}
        >
          <button
            type="button"
            tabIndex={mobileMenuOpen ? 0 : -1}
            className={`absolute inset-0 bg-black/40 transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0'}`}
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className={`relative max-h-[calc(100dvh-3.5rem)] overflow-hidden rounded-none border-b border-[#CCC5BD] bg-[#FCF9F2] transition-transform duration-200 sm:max-h-[calc(100dvh-4rem)] ${
              mobileMenuOpen ? 'translate-y-0' : '-translate-y-2 opacity-0'
            }`}
          >
            <div
              ref={navRef}
              className="max-h-[calc(100dvh-3.5rem)] space-y-1 overflow-y-auto overscroll-contain px-3 py-4 sm:max-h-[calc(100dvh-4rem)]"
            >
              {navItems.map((item) => {
                const active = item.active(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    ref={active ? activeRef : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? 'border-[#9E4300] bg-[#F6F3EC] font-semibold text-[#1C1C18]'
                        : 'border-transparent text-[#4A4640] hover:bg-[#F6F3EC] hover:text-[#1C1C18]'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#9E4300]' : 'text-[#7C766F]'}`} />
                    {item.label}
                  </Link>
                );
              })}
              <button
                type="button"
                onClick={() => signOut()}
                className="flex min-h-11 w-full items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-[#BA1A1A] transition-colors hover:bg-[#F6F3EC]"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
              {user ? (
                <div className="mt-3 flex items-center gap-3 border-t border-[#CCC5BD] px-3 pt-4 pb-2">
                  <CompanyAvatar
                    name={user.name}
                    logoPath={user.avatar_url}
                    size="md"
                    className="rounded-none border border-[#CCC5BD]"
                  />
                  <div className="min-w-0">
                    <div className="truncate sv2-label text-[11px] text-[#1C1C18]" title={user.name}>
                      {user.name}
                    </div>
                    <div
                      className="truncate font-[family-name:var(--font-mono)] text-[10px] text-[#7C766F]"
                      title={user.company_name}
                    >
                      {user.company_name}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
