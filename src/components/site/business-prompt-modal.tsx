'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SHOP_MODE_COOKIE } from '@/lib/catalogue/storefront'
import { BUSINESS_PROMPT_DELAY_MS, shouldShowBusinessPrompt } from '@/lib/business/price-access'

const SEEN_KEY = 'gf-business-prompt'

function choiceCookie() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${SHOP_MODE_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function rememberChoice(mode: 'retail' | 'corporate') {
  document.cookie = `${SHOP_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
}

/** First-visit prompt on the retail homepage. A Retail / Business choice cookie keeps it away. */
export function BusinessPromptModal() {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const router = useRouter()

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1'
    } catch {
      seen = false
    }
    if (!shouldShowBusinessPrompt({ choiceCookie: choiceCookie(), seenThisSession: seen })) return
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        // Private mode can block session storage. The choice cookie still suppresses later visits.
      }
      setOpen(true)
    }, BUSINESS_PROMPT_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#1C1B1A]/40"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md border border-[#CCC5BD] bg-[#FCF9F2] p-6 shadow-none sm:p-8"
      >
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-[#9E4300]">Corporate gifting</p>
        <h2 id={titleId} className="mt-2 font-serif text-2xl font-normal text-[#1C1C18]">
          Corporate or bulk gifting?
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#4A4640]">
          Looking for custom branding, bulk orders, and curated presentations for your company? Visit our corporate gifting portal.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="bg-[#1C1B1A] px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-wider text-[#FCF9F2] hover:bg-[#9E4300]"
            onClick={() => {
              rememberChoice('corporate')
              setOpen(false)
              router.push('/business')
            }}
          >
            Go to business site
          </button>
          <button
            type="button"
            className="border border-[#1C1B1A] bg-transparent px-4 py-2.5 font-sans text-xs font-semibold uppercase tracking-wider text-[#1C1B1A] hover:bg-[#F6F3EC]"
            onClick={() => {
              rememberChoice('retail')
              setOpen(false)
            }}
          >
            Continue shopping
          </button>
        </div>
      </div>
    </div>
  )
}
