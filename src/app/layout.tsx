import type { Metadata, Viewport } from 'next'
import { DM_Serif_Display, JetBrains_Mono, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { appName, appShortName, publicSiteUrl } from '@/lib/brand'
import { Toaster } from 'sonner'
import { NavHistoryTracker } from '@/components/ui/nav-history'
import { TabSessionProvider } from '@/components/auth/tab-session-provider'
import { RecoveryHashRedirect } from '@/components/auth/recovery-hash-redirect'
import { PwaInstallProvider } from '@/components/pwa/pwa-install-provider'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-playfair',
  display: 'swap',
})

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-dm-serif',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#151515',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const siteName = appName()

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl()),
  title: {
    default: `${siteName} — Corporate Gifting`,
    template: `%s · ${siteName}`,
  },
  description:
    'Curated corporate gifts for teams, clients and brands — catalogue, quotation and fulfilment in one place.',
  applicationName: siteName,
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appShortName(),
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
    <html
      lang="en"
      className={`${playfair.variable} ${dmSerif.variable} ${jakarta.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js-ready')`,
          }}
        />
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
