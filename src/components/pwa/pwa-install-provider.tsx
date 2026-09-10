'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type PwaInstallContextValue = {
  canPrompt: boolean
  installed: boolean
  isIos: boolean
  isAndroid: boolean
  ready: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
}

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null)

declare global {
  interface Window {
    __souvenirDeferredInstall?: BeforeInstallPromptEvent | null
  }
}

/** Capture the install event as early as possible (before React listeners mount). */
function ensureEarlyCapture() {
  if (typeof window === 'undefined') return
  if ((window as Window & { __souvenirPwaCapture?: boolean }).__souvenirPwaCapture) return
  ;(window as Window & { __souvenirPwaCapture?: boolean }).__souvenirPwaCapture = true

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    window.__souvenirDeferredInstall = event as BeforeInstallPromptEvent
    window.dispatchEvent(new Event('souvenir-pwa-prompt'))
  })

  window.addEventListener('appinstalled', () => {
    window.__souvenirDeferredInstall = null
    window.dispatchEvent(new Event('souvenir-pwa-installed'))
  })
}

ensureEarlyCapture()

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)

  useEffect(() => {
    ensureEarlyCapture()

    const ua = window.navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const android = /Android/i.test(ua)
    setIsIos(ios)
    setIsAndroid(android)

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)

    if (standalone) {
      setInstalled(true)
      setReady(true)
      return
    }

    const syncPrompt = () => {
      setCanPrompt(Boolean(window.__souvenirDeferredInstall))
    }
    syncPrompt()

    const onPrompt = () => syncPrompt()
    const onInstalled = () => {
      setInstalled(true)
      setCanPrompt(false)
    }

    window.addEventListener('souvenir-pwa-prompt', onPrompt)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('souvenir-pwa-installed', onInstalled)
    window.addEventListener('appinstalled', onInstalled)

    const register = async () => {
      if (!('serviceWorker' in navigator)) {
        setReady(true)
        return
      }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        await reg.update().catch(() => {})
        // Wait briefly for Chromium to evaluate installability after SW is ready.
        if (reg.active || (await navigator.serviceWorker.ready)) {
          syncPrompt()
        }
      } catch {
        // Registration failed — button will fall back to manual instructions.
      } finally {
        setReady(true)
        syncPrompt()
      }
    }

    void register()

    return () => {
      window.removeEventListener('souvenir-pwa-prompt', onPrompt)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('souvenir-pwa-installed', onInstalled)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    const deferred = window.__souvenirDeferredInstall
    if (!deferred) return 'unavailable' as const
    try {
      await deferred.prompt()
      const choice = await deferred.userChoice
      window.__souvenirDeferredInstall = null
      setCanPrompt(false)
      if (choice.outcome === 'accepted') setInstalled(true)
      return choice.outcome
    } catch {
      return 'unavailable' as const
    }
  }, [])

  const value = useMemo(
    () => ({ canPrompt, installed, isIos, isAndroid, ready, install }),
    [canPrompt, installed, isIos, isAndroid, ready, install],
  )

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>
}

export function usePwaInstall() {
  const ctx = useContext(PwaInstallContext)
  if (!ctx) {
    return {
      canPrompt: false,
      installed: false,
      isIos: false,
      isAndroid: false,
      ready: false,
      install: async () => 'unavailable' as const,
    }
  }
  return ctx
}
