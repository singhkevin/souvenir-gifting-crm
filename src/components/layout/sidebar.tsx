'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Building2, Users, TrendingUp, FolderGit2, ClipboardList,
  Package, Image as ImageIcon, FileText, ShoppingBag, KanbanSquare,
  Truck, Printer, Package2, Receipt, CreditCard, ArrowDownToLine,
  BarChart3, Activity, UserCog, Settings, ShieldCheck, LogOut,
  ListTodo, Landmark, BadgeCheck, Megaphone, BookOpen, Target, X
} from 'lucide-react';
import { signOut } from '@/app/login/actions';
import { BrandName } from '@/components/brand/brand-name';
import type { Role } from '@/lib/types';

interface SidebarProps {
  role: Role;
  user?: { name: string; email: string };
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  /** When true on mobile, scroll the active nav item into view. */
  mobileOpen?: boolean;
}

type NavItem = { label: string; href: string; matchPrefix: string; icon: typeof LayoutDashboard };
type NavGroup = { label: string; roles: Role[]; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'WORKSPACE',
    roles: ['admin', 'sales', 'operations', 'accounts', 'management'],
    items: [
      { label: 'Dashboard', href: '/crm/dashboard', matchPrefix: '/crm/dashboard', icon: LayoutDashboard },
      { label: 'My Work', href: '/crm/my-work', matchPrefix: '/crm/my-work', icon: ListTodo },
      { label: 'Tasks', href: '/crm/tasks', matchPrefix: '/crm/tasks', icon: ClipboardList },
    ]
  },
  {
    label: 'CUSTOMERS',
    roles: ['admin', 'sales', 'management'],
    items: [
      { label: 'Companies', href: '/crm/companies', matchPrefix: '/crm/companies', icon: Building2 },
      { label: 'Contacts', href: '/crm/contacts', matchPrefix: '/crm/contacts', icon: Users },
    ]
  },
  {
    label: 'SALES',
    roles: ['admin', 'sales', 'management'],
    items: [
      { label: 'Leads', href: '/crm/leads', matchPrefix: '/crm/leads', icon: TrendingUp },
      { label: 'Goal Tracker', href: '/crm/goals', matchPrefix: '/crm/goals', icon: Target },
      { label: 'Requirements', href: '/crm/requirements', matchPrefix: '/crm/requirements', icon: ClipboardList },
      { label: 'Products', href: '/crm/products', matchPrefix: '/crm/products', icon: Package },
      { label: 'Mockup Storage', href: '/crm/mockups', matchPrefix: '/crm/mockups', icon: ImageIcon },
      { label: 'Quotations', href: '/crm/quotations', matchPrefix: '/crm/quotations', icon: FileText },
      { label: 'Orders', href: '/crm/orders', matchPrefix: '/crm/orders', icon: ShoppingBag },
      { label: 'Samples', href: '/crm/samples', matchPrefix: '/crm/samples', icon: Package2 },
      { label: 'Campaigns', href: '/crm/campaigns', matchPrefix: '/crm/campaigns', icon: FolderGit2 },
      { label: 'Activities', href: '/crm/activities', matchPrefix: '/crm/activities', icon: Activity },
    ]
  },
  {
    label: 'OPERATIONS',
    roles: ['admin', 'operations', 'management'],
    items: [
      { label: 'Order Management', href: '/crm/order-management', matchPrefix: '/crm/order-management', icon: KanbanSquare },
      { label: 'Orders', href: '/crm/orders', matchPrefix: '/crm/orders', icon: ShoppingBag },
      { label: 'Department', href: '/crm/department', matchPrefix: '/crm/department', icon: BadgeCheck },
      { label: 'Suppliers', href: '/crm/suppliers', matchPrefix: '/crm/suppliers', icon: Truck },
      { label: 'Printing', href: '/crm/printing-vendors', matchPrefix: '/crm/printing-vendors', icon: Printer },
      { label: 'Delivery', href: '/crm/courier-partners', matchPrefix: '/crm/courier-partners', icon: Package2 },
      { label: 'Samples', href: '/crm/samples', matchPrefix: '/crm/samples', icon: Package },
    ]
  },
  {
    label: 'FINANCE',
    roles: ['admin', 'accounts', 'management'],
    items: [
      { label: 'Invoices', href: '/crm/invoices', matchPrefix: '/crm/invoices', icon: Receipt },
      { label: 'Payments', href: '/crm/payments', matchPrefix: '/crm/payments', icon: CreditCard },
      { label: 'Receivables', href: '/crm/receivables', matchPrefix: '/crm/receivables', icon: ArrowDownToLine },
      { label: 'Payables', href: '/crm/payables', matchPrefix: '/crm/payables', icon: Landmark },
      { label: 'GST Reports', href: '/crm/gst-reports', matchPrefix: '/crm/gst-reports', icon: BarChart3 },
    ]
  },
  {
    label: 'MANAGEMENT',
    roles: ['admin', 'management'],
    items: [
      { label: 'Reports', href: '/crm/reports', matchPrefix: '/crm/reports', icon: BarChart3 },
      { label: 'Tracking', href: '/crm/tracking', matchPrefix: '/crm/tracking', icon: Activity },
      { label: 'Reviews', href: '/crm/reviews', matchPrefix: '/crm/reviews', icon: BadgeCheck },
      { label: 'Activities', href: '/crm/activities', matchPrefix: '/crm/activities', icon: Activity },
      { label: 'Audit Log', href: '/crm/audit-log', matchPrefix: '/crm/audit-log', icon: ShieldCheck },
    ]
  },
  {
    label: 'SYSTEM',
    roles: ['admin', 'sales', 'operations', 'accounts', 'management'],
    items: [
      { label: 'Announcements', href: '/crm/announcements', matchPrefix: '/crm/announcements', icon: Megaphone },
      { label: 'Knowledge Center', href: '/crm/knowledge', matchPrefix: '/crm/knowledge', icon: BookOpen },
    ]
  },
  {
    label: 'ADMIN',
    roles: ['admin'],
    items: [
      { label: 'My Team', href: '/crm/team', matchPrefix: '/crm/team', icon: UserCog },
      { label: 'Settings', href: '/crm/settings', matchPrefix: '/crm/settings', icon: Settings },
    ]
  }
];

const SCROLL_KEY = 'giffter.crm.sidebar.scrollTop'

export function Sidebar({ role, user, onNavigate, showClose, onClose, mobileOpen }: SidebarProps) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null)
  const activeRef = useRef<HTMLAnchorElement | null>(null)

  const displayName = user?.name?.trim() || 'User';
  const roleName = role === 'admin' ? 'Admin' : role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  const seenHrefs = new Set<string>()
  const visibleGroups = navGroups.flatMap((group) => {
    if (!group.roles.includes(role)) return []
    const items = group.items.filter((item) => {
      if (seenHrefs.has(item.href)) return false
      seenHrefs.add(item.href)
      return true
    })
    return items.length ? [{ ...group, items }] : []
  })

  // Restore last scroll, then ensure the current page link is visible when the drawer opens.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    const saved = Number.parseInt(sessionStorage.getItem(SCROLL_KEY) || '', 10)
    if (Number.isFinite(saved) && saved > 0) {
      nav.scrollTop = saved
    }

    if (mobileOpen === false) return
    // Desktop sidebar (no mobileOpen) and mobile-open both scroll active into view.
    if (mobileOpen === undefined || mobileOpen) {
      requestAnimationFrame(() => {
        const el = activeRef.current
        if (!el) return
        const navRect = nav.getBoundingClientRect()
        const elRect = el.getBoundingClientRect()
        if (elRect.top < navRect.top) nav.scrollTop -= navRect.top - elRect.top
        else if (elRect.bottom > navRect.bottom) nav.scrollTop += elRect.bottom - navRect.bottom
      })
    }
  }, [pathname, mobileOpen])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => {
      sessionStorage.setItem(SCROLL_KEY, String(nav.scrollTop))
    }
    nav.addEventListener('scroll', onScroll, { passive: true })
    return () => nav.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <aside className="flex h-full max-h-screen min-h-0 w-64 flex-shrink-0 select-none flex-col border-r border-[#1B3224] bg-[#16281E] text-[#A3B5AA]">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#21382A] px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <Link href="/crm/dashboard" onClick={onNavigate} className="group block min-w-0">
          <BrandName
            as="h1"
            className="font-serif text-xl font-normal leading-tight tracking-tight text-[#FAF7F2] transition-colors group-hover:text-white sm:text-2xl"
          />
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8B9E92]">
            Corporate Gifting CRM
          </p>
        </Link>
        {showClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#FAF7F2] hover:bg-[#1E3628]"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <nav
        ref={navRef}
        className="min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-4"
      >
        {visibleGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#697D71]">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.matchPrefix !== '/crm/dashboard' && pathname.startsWith(item.matchPrefix));
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      ref={isActive ? activeRef : undefined}
                      onClick={onNavigate}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[#274433] font-semibold text-[#FAF7F2] shadow-sm'
                          : 'text-[#9EB0A4] hover:bg-[#1E3628] hover:text-[#FAF7F2]'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#FAF7F2]' : 'text-[#7D9385]'}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-[#21382A] bg-[#122219] p-4">
        <div className="mb-2 min-w-0">
          <p className="truncate text-sm font-medium text-[#FAF7F2]">{displayName}</p>
          <p className="truncate text-xs text-[#7D9385]">{user?.email || roleName}</p>
          <p className="text-[11px] text-[#697D71]">{roleName}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="flex min-h-10 items-center gap-2 pt-1 text-xs text-[#A3B5AA] transition-colors hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
