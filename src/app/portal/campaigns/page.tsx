import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function PortalCampaignsPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, employee_quantity, budget_per_employee, total_budget, required_delivery_date, status')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Campaigns</h1>
      <div className="space-y-3">
        {(campaigns || []).map((c) => (
          <div key={c.id} className="rounded-2xl border bg-white p-4 sm:p-5">
            <p className="font-serif text-lg">{c.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {c.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(c.budget_per_employee)} per person · {formatCurrency(c.total_budget)} total
            </p>
            <p className="mt-1 text-xs">Delivery {formatDate(c.required_delivery_date)}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={`/portal/catalogue?campaign=${c.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
              >
                View published products
              </Link>
              <Link
                href="/portal/orders"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
              >
                View related orders
              </Link>
            </div>
          </div>
        ))}
        {(!campaigns || campaigns.length === 0) && <p className="text-gray-500">No published campaigns.</p>}
      </div>
    </div>
  )
}
