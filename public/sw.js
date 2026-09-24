/* Souvenir - Gifting Solutions PWA service worker */
const CACHE = 'souvenir-pwa-v3'
const PRECACHE = ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // Don't fail the whole SW if one asset 404s — install must succeed for beforeinstallprompt.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.includes('supabase') ||
    url.searchParams.has('code')
  ) {
    return
  }

  if (request.mode === 'navigate') {
    // Never cache CRM/portal HTML — a stale "restoring session" document
    // would block login and tab-scoped auth.
    event.respondWith(
      fetch(request).catch(async () => {
        if (
          url.pathname.startsWith('/crm') ||
          url.pathname.startsWith('/portal') ||
          url.pathname.startsWith('/login')
        ) {
          return Response.error()
        }
        return (await caches.match(request)) || (await caches.match('/')) || Response.error()
      }),
    )
    return
  }

  const isStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    url.pathname.startsWith('/site') ||
    /\.(?:png|jpg|jpeg|webp|svg|gif|ico|css|js|woff2?)$/i.test(url.pathname)

  if (!isStatic) return

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (!response.ok) return response
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {})
        return response
      })
    }),
  )
})
