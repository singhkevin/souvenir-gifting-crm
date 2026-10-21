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
    <div className="space-y-8">
      <div>
        <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Business account</p>
        <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">Hello{profile.full_name ? `, ${profile.full_name}` : ''}</h1>
        <p className="mt-2 text-sm text-[#4A4640] max-w-2xl">
          {company?.business_verification === 'verified'
            ? 'Your account is approved. Indicative prices are not the final quote.'
            : 'Pending approval. You can browse the catalogue. Quote requests open after sales approves this account. Indicative prices are not the final quote.'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/business/requests"
          className="border border-[#CCC5BD] bg-[#FCF9F2] p-5 rounded-none hover:border-[#1C1C18] hover:bg-[#F6F3EC] transition-colors group block"
        >
          <div className="flex items-center justify-between">
            <p className="sv2-label text-[10px] text-[#7C766F]">Quote requests</p>
            <span className="sv2-label text-[10px] text-[#9E4300] group-hover:underline">View all →</span>
          </div>
          <p className="mt-3 sv2-mono-lg text-3xl font-bold text-[#1C1C18]">
            {requests?.count ?? '—'}
          </p>
        </Link>
        <Link
          href="/business/quotes"
          className="border border-[#CCC5BD] bg-[#FCF9F2] p-5 rounded-none hover:border-[#1C1C18] hover:bg-[#F6F3EC] transition-colors group block"
        >
          <div className="flex items-center justify-between">
            <p className="sv2-label text-[10px] text-[#7C766F]">Quotes to review</p>
            <span className="sv2-label text-[10px] text-[#9E4300] group-hover:underline">View all →</span>
          </div>
          <p className="mt-3 sv2-mono-lg text-3xl font-bold text-[#1C1C18]">
            {quotes?.count ?? '—'}
          </p>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Link
          href="/business/catalogue"
          className="inline-block bg-[#000000] px-5 py-3 sv2-label text-xs text-white hover:bg-[#9E4300] transition-colors rounded-none"
        >
          Browse catalogue
        </Link>
        <Link
          href="/business/quote"
          className="inline-block border border-[#CCC5BD] bg-[#FCF9F2] px-5 py-3 sv2-label text-xs text-[#1C1C18] hover:border-[#1C1C18] hover:bg-[#F6F3EC] transition-colors rounded-none"
        >
          Quote basket
        </Link>
      </div>
    </div>
  )
}

