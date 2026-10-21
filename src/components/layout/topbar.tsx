'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Bell, Menu, Search, X } from 'lucide-react'
import { BrandName } from '@/components/brand/brand-name'
import { markNotificationRead } from '@/app/crm/notifications/actions'

type Note = {
  id: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function Topbar({
  user,
  notifications = [],
  onMenuClick,
}: {
  user?: { name?: string; email?: string }
  notifications?: Note[]
  onMenuClick?: () => void
}) {
  const email = user?.email || ''
  const displayName = user?.name?.trim() || email.split('@')[0] || ''
  const initial = (displayName || email || 'U').charAt(0).toUpperCase()
  const unread = notifications.filter((n) => !n.read_at).length
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [, start] = useTransition()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="relative z-30 flex min-h-14 shrink-0 flex-col border-b border-[#CCC5BD] bg-[#FCF9F2]">
      <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640] hover:bg-[#FCF9F2] hover:text-[#1C1B1A] transition-colors lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}
          <Link
            href="/crm/dashboard"
            className="truncate font-[family-name:var(--font-newsreader)] text-xl font-normal tracking-tight text-[#1C1B1A] lg:hidden"
          >
            <BrandName />
          </Link>
          <p className="hidden text-xs text-[#4A4640] lg:block">
            Corporate gifting, from enquiry to payment
          </p>
        </div>

        <form action="/crm/search" className="mx-4 hidden max-w-md flex-1 items-center md:flex">
          <div className="relative w-full">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#7C766F]">
              <Search className="h-4 w-4" />
            </span>
            <input
              name="q"
              placeholder="Search orders, clients, catalogs…"
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] py-1.5 pl-9 pr-3 text-xs text-[#1C1B1A] placeholder-[#7C766F] outline-none focus:border-[#1C1B1A] transition-colors"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640] hover:bg-[#FCF9F2] hover:text-[#1C1B1A] transition-colors md:hidden"
            aria-label="Search"
            onClick={() => {
              setSearchOpen((value) => !value)
              setOpen(false)
            }}
          >
            {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value)
              setSearchOpen(false)
            }}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] text-[#4A4640] hover:bg-[#FCF9F2] hover:text-[#1C1B1A] transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#9E4300] px-1 font-mono text-[10px] font-bold leading-none text-[#FCF9F2]">
                {unread}
              </span>
            ) : null}
          </button>

          {email || displayName ? (
            <>
              <div className="hidden h-5 w-[1px] bg-[#CCC5BD] sm:block" />
              <div className="hidden items-center gap-2.5 sm:flex">
                <div className="text-right">
                  {displayName ? (
                    <p className="max-w-[12rem] truncate text-xs font-semibold text-[#1C1B1A] leading-tight">
                      {displayName}
                    </p>
                  ) : null}
                  {email ? (
                    <p className="max-w-[12rem] truncate text-[11px] text-[#7C766F] leading-tight">
                      {email}
                    </p>
                  ) : null}
                </div>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-[#1C1B1A] text-xs font-bold text-[#FCF9F2]">
                  {initial}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {searchOpen ? (
        <form action="/crm/search" className="border-t border-[#CCC5BD] bg-[#FCF9F2] px-3 py-2.5 md:hidden">
          <div className="relative flex items-center">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#7C766F]">
              <Search className="h-4 w-4" />
            </span>
            <input
              autoFocus
              name="q"
              placeholder="Search orders, clients, catalogs…"
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] py-2 pl-9 pr-3 text-sm text-[#1C1B1A] placeholder-[#7C766F] outline-none focus:border-[#1C1B1A]"
            />
          </div>
        </form>
      ) : null}

      {open ? (
        <div className="absolute right-3 top-14 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-none border border-[#CCC5BD] bg-[#FCF9F2] shadow-none sm:right-6">
          <div className="flex items-center justify-between border-b border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              Notifications
            </span>
            {unread > 0 ? (
              <span className="font-mono text-[10px] font-bold text-[#9E4300]">
                {unread} unread
              </span>
            ) : null}
          </div>
          <div className="max-h-[min(22rem,50vh)] overflow-y-auto divide-y divide-[#CCC5BD]">
            {notifications.length === 0 ? (
              <p className="p-4 text-xs text-[#7C766F]">No notifications yet.</p>
            ) : null}
            {notifications.slice(0, 12).map((n) => (
              <Link
                key={n.id}
                href={n.link || '/crm/dashboard'}
                onClick={() => {
                  setOpen(false)
                  if (!n.read_at) start(() => markNotificationRead(n.id))
                }}
                className={`block px-3 py-3 transition-colors hover:bg-[#F6F3EC] ${
                  n.read_at ? 'bg-[#FCF9F2]' : 'border-l-2 border-[#9E4300] bg-[#F6F3EC]/70'
                }`}
              >
                <p className="text-xs font-semibold text-[#1C1B1A]">{n.title}</p>
                {n.body ? <p className="mt-0.5 line-clamp-2 text-[11px] text-[#4A4640]">{n.body}</p> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  )
}
