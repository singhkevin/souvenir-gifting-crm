'use client'

import { useLayoutEffect } from 'react'
import { TAB_QUERY, TAB_STORAGE_KEY, createTabId } from '@/lib/auth/tab'
import { getTabId } from '@/lib/supabase/client'

const REVIVE_ONCE_KEY = 'giffter.tab-revive-reload'

export function TabSessionRevive() {
  useLayoutEffect(() => {
    if (!sessionStorage.getItem(TAB_STORAGE_KEY)) {
      sessionStorage.setItem(TAB_STORAGE_KEY, createTabId())
    }
    const tabId = getTabId()
    const url = new URL(window.location.href)
    if (url.searchParams.get(TAB_QUERY) !== tabId) {
      url.searchParams.set(TAB_QUERY, tabId)
      window.location.replace(url.toString())
      return
    }
    // Query is already set but this render still missed the tab id (layout
    // cache / missing request header). Reload once so proxy can attach it.
    if (sessionStorage.getItem(REVIVE_ONCE_KEY) === url.href) return
    sessionStorage.setItem(REVIVE_ONCE_KEY, url.href)
    window.location.reload()
  }, [])

  return (
    <div className="min-h-screen bg-[#F4EFE6] flex items-center justify-center">
      <p className="text-sm text-[#7A7267]">Restoring this tab’s session…</p>
    </div>
  )
}
