'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PORTAL_FIND_MESSAGE } from '@/lib/portal-find-message'

export function PortalFinderForm() {
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/portal-find', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await response.json().catch(() => null) as { message?: string; redirectTo?: string | null } | null
      const redirectTo = typeof data?.redirectTo === 'string' ? data.redirectTo : ''
      const local = redirectTo.startsWith('http://localhost') || redirectTo.startsWith('http://127.0.0.1')
      if (response.ok && redirectTo.endsWith('/login') && (redirectTo.startsWith('https://') || local)) {
        window.location.assign(redirectTo)
        return
      }
      setMessage(typeof data?.message === 'string' ? data.message : PORTAL_FIND_MESSAGE)
    } catch {
      setMessage(PORTAL_FIND_MESSAGE)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-left">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5A5248]">
          Company code
        </span>
        <input
          name="query"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={200}
          placeholder="company code"
          className="block w-full border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-3 text-base text-[#1C1917] placeholder:text-[#A8A29E] focus:border-[#806A50] focus:outline-none focus:ring-1 focus:ring-[#806A50] sm:py-2.5 sm:text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center bg-[#806A50] px-4 py-3 text-xs font-semibold text-white hover:bg-[#9C8567] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Open portal'}
      </button>
      {message ? (
        <p className="border border-[#E5DFD5] bg-[#FAF7F2] px-3 py-3 text-xs leading-relaxed text-[#5A5248]" role="status">
          {message}
        </p>
      ) : null}
    </form>
  )
}
