'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { hasInAppHistory } from './nav-history';

interface BackButtonProps {
  href?: string;
  label?: string;
  fallback?: string;
  className?: string;
}

/**
 * Derives the logical parent route from the current path, e.g.
 * /crm/companies/<id> -> /crm/companies. Used when no explicit href is given
 * and when there is no in-app history to return to.
 */
export function parentRoute(pathname: string | null): string {
  if (!pathname) return '/crm/dashboard';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 2) return `/${segments.slice(0, -1).join('/')}`;
  if (segments[0] === 'portal') return '/portal/catalogue';
  return '/crm/dashboard';
}

export function BackButton({ href, label = 'Back', fallback, className = '' }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Always render a real anchor so the control works before hydration, supports
  // middle-click / open-in-new-tab, and degrades safely if JS fails.
  const target = href || fallback || parentRoute(pathname);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modified clicks (new tab, download, etc.).
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();

    // Returning to the genuine previous in-app view preserves the list's filters,
    // search and pagination. With no in-app history (deep link, refresh, external
    // referrer) going back would leave the app, so navigate to the parent instead.
    if (hasInAppHistory()) {
      router.back();
    } else {
      router.push(target);
    }
  };

  return (
    <Link
      href={target}
      onClick={handleClick}
      className={`inline-flex items-center text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors ${className}`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Link>
  );
}
