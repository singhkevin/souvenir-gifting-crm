import type { Metadata } from 'next'
import { Cormorant_Garamond, Outfit } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'
import { NavHistoryTracker } from '@/components/ui/nav-history'
import { TabSessionProvider } from '@/components/auth/tab-session-provider'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Gifting Solutions — Corporate Gifting',
  description: 'Curated corporate gifts for teams, clients and brands — catalogue, quotation and fulfilment in one place.',
  applicationName: 'Gifting Solutions',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${cormorant.variable}`}>
      <body className="h-full antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var h=location.hash;if(!h||h.length<2)return;var p=new URLSearchParams(h.slice(1));if(p.get("type")==="recovery"||(p.get("access_token")&&p.get("refresh_token"))){if(location.pathname.indexOf("/reset-password")!==0){location.replace("/reset-password"+location.search+location.hash)}}}catch(e){}})();`,
          }}
        />
        <TabSessionProvider>
          <NavHistoryTracker />
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TabSessionProvider>
      </body>
    </html>
  )
}
