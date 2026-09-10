'use client'

import { useState } from 'react'
import { Download, X, Share } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePwaInstall } from '@/components/pwa/pwa-install-provider'

function waitForDeferredPrompt(timeoutMs = 2500) {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    if (window.__souvenirDeferredInstall) {
      resolve(true)
      return
    }
    const done = (ok: boolean) => {
      window.clearTimeout(timer)
      window.removeEventListener('souvenir-pwa-prompt', onPrompt)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      resolve(ok)
    }
    const onPrompt = () => done(true)
    const timer = window.setTimeout(() => done(Boolean(window.__souvenirDeferredInstall)), timeoutMs)
    window.addEventListener('souvenir-pwa-prompt', onPrompt)
    window.addEventListener('beforeinstallprompt', onPrompt)
  })
}

/** Triggers the native install prompt when available (Chrome/Edge/Android). */
export function PwaInstallButton({
  className,
  variant = 'light',
}: {
  className?: string
  variant?: 'light' | 'dark'
}) {
  const { canPrompt, installed, isIos, ready, install } = usePwaInstall()
  const [hintOpen, setHintOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!ready || installed) {
    return <span className="hidden" aria-hidden="true" />
  }

  const isDark = variant === 'dark'

  const onInstall = async () => {
    if (busy) return
    setBusy(true)
    setHintOpen(false)
    try {
      if (!window.__souvenirDeferredInstall) {
        await waitForDeferredPrompt(2800)
      }
      const result = await install()
      if (result === 'unavailable') {
        setHintOpen(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onInstall}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-90 disabled:opacity-60',
          isDark
            ? 'rounded-sm border border-white/35 px-2.5 py-1.5 text-white/95'
            : 'rounded-sm border border-[#D9D3C9] px-2.5 py-1.5 text-[#1A3022]',
          className,
        )}
      >
        <Download size={13} strokeWidth={2} />
        {busy ? 'Installing…' : canPrompt ? 'Install app' : isIos ? 'Add to Home' : 'Install app'}
      </button>

      {hintOpen ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-[#E8E4DE] bg-white p-3 text-left text-xs leading-relaxed text-[#1B2430] shadow-lg">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="font-medium">Install Souvenir</p>
            <button type="button" aria-label="Close" onClick={() => setHintOpen(false)} className="text-[#5C6570]">
              <X size={14} />
            </button>
          </div>
          {isIos ? (
            <ol className="list-decimal space-y-1.5 pl-4 text-[#5C6570]">
              <li className="flex flex-wrap items-center gap-1">
                Tap <Share size={12} className="inline text-[#1B2430]" /> Share in Safari
              </li>
              <li>
                Choose <span className="font-medium text-[#1B2430]">Add to Home Screen</span>
              </li>
              <li>
                Tap <span className="font-medium text-[#1B2430]">Add</span>
              </li>
            </ol>
          ) : (
            <div className="space-y-2 text-[#5C6570]">
              <p>
                The install dialog is provided by your browser. Use <span className="font-medium text-[#1B2430]">Chrome</span> or{' '}
                <span className="font-medium text-[#1B2430]">Edge</span> on desktop, or Chrome on Android.
              </p>
              <p>
                Then look for the install icon in the address bar, or open the browser menu →{' '}
                <span className="font-medium text-[#1B2430]">Install app</span> /{' '}
                <span className="font-medium text-[#1B2430]">Install Souvenir</span>.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
