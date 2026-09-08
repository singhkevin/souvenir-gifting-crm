'use client'

import React, { useEffect, useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import type { Role } from '@/lib/types'

type Note = {
  id: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function CrmFrame({
  role,
  user,
  notifications,
  children,
}: {
  role: Role
  user: { name: string; email: string }
  notifications: Note[]
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#F4EFE6]">
      <div className="hidden h-full min-h-0 lg:flex">
        <Sidebar role={role} user={user} />
      </div>

      {/* Keep mounted so nav scroll position is preserved between opens */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          className={`absolute inset-0 bg-[#122018]/50 backdrop-blur-[1px] transition-opacity duration-200 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
        <div
          className={`relative flex h-full w-[min(20rem,88vw)] max-w-full shadow-2xl transition-transform duration-200 ease-out ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            role={role}
            user={user}
            onNavigate={() => setOpen(false)}
            showClose
            onClose={() => setOpen(false)}
            mobileOpen={open}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} notifications={notifications} onMenuClick={() => setOpen(true)} />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#F4EFE6] overscroll-y-contain">
          <div className="mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
