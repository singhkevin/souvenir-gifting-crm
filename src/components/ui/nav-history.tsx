'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export const NAV_DEPTH_KEY = 'giffter:nav-depth';

/**
 * Counts in-app navigations for the current tab so that BackButton can tell the
 * difference between "the user arrived here from another Souvenir Gifting Solutions page" and "the
 * user landed here directly via a deep link, refresh or external link".
 *
 * The counter only ever increases; it is a marker that in-app history exists,
 * not a pointer into the history stack.
 */
export function NavHistoryTracker() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const current = Number(window.sessionStorage.getItem(NAV_DEPTH_KEY) || '0');
      window.sessionStorage.setItem(NAV_DEPTH_KEY, String(current + 1));
    } catch {
      // Private mode / storage disabled: BackButton falls back to its parent link.
    }
  }, [pathname]);

  return null;
}

export function hasInAppHistory() {
  try {
    return Number(window.sessionStorage.getItem(NAV_DEPTH_KEY) || '0') >= 2;
  } catch {
    return false;
  }
}
