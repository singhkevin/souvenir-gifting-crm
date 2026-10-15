import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { StoreButton, StoreCard, StoreTitle } from '@/components/site/store-ui'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function BusinessDashboardPage() {
  const { profile, company } = await requireBusiness()
  const supabase = await createClient()
  const companyId = company?.id || profile.company_id
  const [requests, quotes] = companyId
    ? await Promise.all([
        supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('source', 'business_portal'),
        supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('status', ['sent', 'viewed']),
      ])
    : [null, null]

  return (
    <div className="space-y-6">
      <StoreTitle
        eyebrow="Business"
        title={`Hello${profile.full_name ? `, ${profile.full_name}` : ''}`}
        lede={
          company?.business_verification === 'verified'
            ? 'Your account is approved. Indicative prices are not the final quote.'
            : 'Pending approval. You can browse the catalogue. Quote requests open after sales approves this account. Indicative prices are not the final quote.'
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/business/requests">
          <StoreCard className="p-5 transition hover:-translate-y-0.5">
            <p className="store-eyebrow">Quote requests</p>
            <p className="mt-2 font-serif text-3xl">{requests?.count ?? '—'}</p>
          </StoreCard>
        </Link>
        <Link href="/business/quotes">
          <StoreCard className="p-5 transition hover:-translate-y-0.5">
            <p className="store-eyebrow">Quotes to review</p>
            <p className="mt-2 font-serif text-3xl">{quotes?.count ?? '—'}</p>
          </StoreCard>
        </Link>
      </div>
      <StoreButton href="/business/catalogue">Browse catalogue</StoreButton>
    </div>
  )
}
