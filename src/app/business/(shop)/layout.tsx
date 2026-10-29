import { readBusinessSession } from '@/lib/business/session'
import { BusinessFrame } from '@/components/business/business-frame'
import { BusinessPublicFrame } from '@/components/business/business-public-frame'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

export const dynamic = 'force-dynamic'

export default async function BusinessShopLayout({ children }: { children: React.ReactNode }) {
  const session = await readBusinessSession()
  if (session) {
    return (
      <div
        className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18] antialiased`}
      >
        <BusinessFrame
          companyName={session.company?.name || null}
          verification={session.company?.business_verification || null}
        >
          {children}
        </BusinessFrame>
      </div>
    )
  }
  return <BusinessPublicFrame>{children}</BusinessPublicFrame>
}
