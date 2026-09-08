'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, LogOut, PackageSearch, Heart, FileText, ShoppingBag, LayoutDashboard, FolderGit2, Files, ClipboardList } from 'lucide-react';
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

export function PortalLayout({ children, user }: PortalLayoutProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <div className="flex min-h-[100dvh] flex-col bg-gray-50">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between sm:h-16">
            <div className="flex min-w-0 items-center gap-3 sm:gap-8">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-xl font-bold text-white">
                  G
                </div>
                <span className="hidden max-w-[11rem] truncate font-bold tracking-tight text-primary sm:block sm:text-lg">
                  Gifting Solutions
                </span>
              </div>
              
              <nav className="hidden items-center space-x-1 md:flex">
                {navItems.map((item) => {
                  const isActive = item.href === '/portal'
                    ? pathname === '/portal'
                    : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary/5 text-primary'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-gray-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {user && (
                <div className="hidden items-center gap-3 border-l border-gray-200 pl-4 sm:flex">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.company_name}</p>
                  </div>
                  <CompanyAvatar name={user.name} logoPath={user.avatar_url} size="md" />
                </div>
              )}
              <button
                onClick={() => signOut()}
                className="hidden rounded-md p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 md:flex"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
              
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 md:hidden"
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

        {mobileMenuOpen ? (
          <div className="fixed inset-0 top-14 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/30"
              aria-label="Close menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-gray-200 bg-white shadow-lg">
              <div className="space-y-1 px-2 py-3 sm:px-3">
                {navItems.map((item) => {
                  const isActive =
                    item.href === '/portal' ? pathname === '/portal' : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
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
              </div>
              {user ? (
                <div className="flex items-center gap-3 border-t border-gray-200 px-5 py-4">
                  <CompanyAvatar name={user.name} logoPath={user.avatar_url} size="md" />
                  <div className="min-w-0">
                    <div className="truncate text-base font-medium text-gray-800">{user.name}</div>
                    <div className="truncate text-sm font-medium text-gray-500">{user.company_name}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
