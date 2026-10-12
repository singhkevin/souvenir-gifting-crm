import { requireBusiness } from '@/lib/business/session'
import { BusinessFrame } from '@/components/business/business-frame'

export const dynamic = 'force-dynamic'

export default async function BusinessPortalLayout({ children }: { children: React.ReactNode }) {
  const { company } = await requireBusiness()
  return (
    <BusinessFrame companyName={company?.name || null} verification={company?.business_verification || null}>
      {children}
    </BusinessFrame>
  )
}
