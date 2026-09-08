import type { Metadata } from "next"
import { Inter, Playfair_Display } from "next/font/google"
import "./globals.css"
import { Toaster } from "sonner"
import { NavHistoryTracker } from "@/components/ui/nav-history"
import { TabSessionProvider } from "@/components/auth/tab-session-provider"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

export const metadata: Metadata = {
  title: "GIFFTER — Corporate Gifting CRM",
  description: "B2B corporate gifting CRM from first enquiry through fulfilment, invoicing, and payment.",
  applicationName: "GIFFTER",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
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
