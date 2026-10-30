import { getBusinessAccess } from '@/lib/business/access'
import { BusinessAccessNotice } from '@/components/business/access-notice'
import { BusinessFrame } from '@/components/business/business-frame'
import { BusinessPublicFrame } from '@/components/business/business-public-frame'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

export const dynamic = 'force-dynamic'

export default async function BusinessShopLayout({ children }: { children: React.ReactNode }) {
  const access = await getBusinessAccess()
  if (access.state === 'verified' || access.state === 'pending') {
    return (
      <div
        className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18] antialiased`}
      >
        <BusinessFrame
          companyName={access.company?.name || null}
          verification={access.company?.business_verification || null}
        >
          {children}
        </BusinessFrame>
      </div>
    )
  }
  return (
    <BusinessPublicFrame>
      <BusinessAccessNotice access={access} />
      {children}
    </BusinessPublicFrame>
  )
}
