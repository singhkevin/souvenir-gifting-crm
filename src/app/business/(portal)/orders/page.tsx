import Link from 'next/link'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function BusinessOrdersPage() {
  const { company, profile } = await requireBusiness()
  const companyId = company?.id || profile.company_id
  const supabase = await createClient()
  const { data } = companyId
    ? await supabase
        .from('orders')
        .select('id, order_number, status, order_value, created_at, quotation_id')
        .eq('company_id', companyId)
        .not('quotation_id', 'is', null)
        .order('created_at', { ascending: false })
    : { data: [] }

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Orders</h1>
      <p className="text-sm text-[#5C6570]">Orders created from an accepted business quote.</p>
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {(data || []).map((row) => (
          <li key={row.id}>
            <Link href={`/business/orders/${row.id}`} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">{row.order_number}</span>
                <span className="text-xs text-[#5C6570]">{formatDate(row.created_at)}</span>
              </span>
              <span className="text-right">
                <span className="block capitalize">{row.status}</span>
                <span className="text-xs text-[#5C6570]">{formatCurrency(row.order_value)}</span>
              </span>
            </Link>
          </li>
        ))}
        {!(data || []).length ? <li className="px-4 py-6 text-sm text-[#5C6570]">No quote orders yet.</li> : null}
      </ul>
    </div>
  )
}
