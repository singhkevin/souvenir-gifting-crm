import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
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
      <div>
        <h1 className="font-serif text-3xl">Hello{profile.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p className="mt-2 text-sm text-[#5C6570]">
          Verification: {company?.business_verification || 'pending'}. Indicative prices are not the final quote.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/business/requests" className="rounded-lg border border-[#E8E4DE] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#5C6570]">Quote requests</p>
          <p className="mt-2 text-2xl">{requests?.count ?? '—'}</p>
        </Link>
        <Link href="/business/quotes" className="rounded-lg border border-[#E8E4DE] bg-white p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[#5C6570]">Quotes to review</p>
          <p className="mt-2 text-2xl">{quotes?.count ?? '—'}</p>
        </Link>
      </div>
      <Link href="/business/catalogue" className="inline-block bg-[#806A50] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
        Browse catalogue
      </Link>
    </div>
  )
}
