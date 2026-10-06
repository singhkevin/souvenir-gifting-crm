import type { MetadataRoute } from 'next'
import { appName, appShortName } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: appName(),
    short_name: appShortName(),
    description:
      'Corporate gifting CRM and catalogue - browse gifts, request quotes, and manage fulfilment.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#F4EFE6',
    theme_color: '#806A50',
    categories: ['business', 'shopping', 'productivity'],
    lang: 'en',
    dir: 'ltr',
    prefer_related_applications: false,
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
