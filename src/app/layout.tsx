import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'sonner'
import { NavHistoryTracker } from '@/components/ui/nav-history'
import { TabSessionProvider } from '@/components/auth/tab-session-provider'
import { RecoveryHashRedirect } from '@/components/auth/recovery-hash-redirect'
import { PwaInstallProvider } from '@/components/pwa/pwa-install-provider'

const FONT_STYLESHEET =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap'

export const viewport: Viewport = {
  themeColor: '#806A50',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
export const metadata: Metadata = {
  title: 'Souvenir - Gifting Solutions — Corporate Gifting',
  description:
    'Curated corporate gifts for teams, clients and brands — catalogue, quotation and fulfilment in one place.',
  applicationName: 'Souvenir - Gifting Solutions',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Souvenir',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body className="h-full antialiased">
        <RecoveryHashRedirect />
        <PwaInstallProvider>
          <TabSessionProvider>
            <NavHistoryTracker />
            {children}
            <Toaster position="top-right" richColors closeButton />
          </TabSessionProvider>
        </PwaInstallProvider>
      </body>
    </html>
  )
}
