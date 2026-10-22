import { requireBusiness } from '@/lib/business/session'
import { BusinessFrame } from '@/components/business/business-frame'
import { newsreader, plusJakarta, jetbrainsMono } from '@/lib/fonts'
import '@/app/sv2.css'

export const dynamic = 'force-dynamic'

export default async function BusinessPortalLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireBusiness()
  return (
    <div
      className={`sv2 ${newsreader.variable} ${plusJakarta.variable} ${jetbrainsMono.variable} min-h-screen bg-[#FCF9F2] text-[#1C1C18] antialiased`}
    >
      <BusinessFrame companyName={company?.name || null} verification={company?.business_verification || null}>
        {children}
      </BusinessFrame>
    </div>
  )
}

