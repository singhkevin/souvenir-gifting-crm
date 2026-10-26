'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/app/login/actions'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/crm/crm-sv2.css'

/** Minimal frame for the runner login: one screen, no CRM navigation. */
export function RunnerFrame({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  // Data is protected by RLS (runners only read their own jobs); this just keeps them on their screen.
  const allowed = pathname === '/crm/runs' || pathname.startsWith('/crm/runs/') || pathname === '/crm/notifications'
  useEffect(() => {
    if (!allowed) router.replace('/crm/runs')
  }, [allowed, router])
  if (!allowed) return null
  return (
    <div className={`sv2-crm ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-[100dvh] bg-[#F6F3EC] text-[#1C1C18]`}>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[#CCC5BD] bg-[#FCF9F2] px-4 py-3">
        <Link href="/crm/runs" className="font-[family-name:var(--font-newsreader)] text-lg">My runs</Link>
        <div className="flex items-center gap-3 text-xs text-[#4A4640]">
          <span className="truncate max-w-[40vw]">{name}</span>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1 border border-[#CCC5BD] px-2 py-1 text-[11px] uppercase tracking-[0.12em]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-3 py-4">{children}</main>
    </div>
  )
}
