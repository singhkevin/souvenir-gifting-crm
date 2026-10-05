import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { listCompanyCatalogs } from '@/lib/catalogs/company-catalogs'
import { catalogStatusLabel } from '@/lib/catalogs/status'

export default async function PortalCatalogsPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const catalogs = await listCompanyCatalogs(supabase, companyId)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">Catalogs</h1>
      <div className="space-y-3">
        {catalogs.map((catalog) => (
          <div key={catalog.id} className="rounded-2xl border bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-serif text-lg">{catalog.name}</p>
              <span className="rounded-full bg-[#E1EFFE] px-2.5 py-0.5 text-[10px] font-semibold text-[#1E429F]">
                {catalogStatusLabel(catalog.status)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {catalog.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(catalog.budget_per_employee)} per person · {formatCurrency(catalog.total_budget)} total
            </p>
            <p className="mt-1 text-xs">Delivery {formatDate(catalog.required_delivery_date)}</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Link
                href={`/portal/catalogue?catalog=${catalog.id}#request-quotation`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-[#FFFFFF] hover:bg-[#9C8567]"
              >
                Request Quotation
              </Link>
              <Link
                href={`/portal/catalogue?catalog=${catalog.id}`}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#806A50] hover:bg-[#FAF7F2]"
              >
                Compare budget options
              </Link>
              <Link
                href="/portal/orders"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#806A50] hover:bg-[#FAF7F2]"
              >
                View related orders
              </Link>
            </div>
          </div>
        ))}
        {catalogs.length === 0 && <p className="text-gray-500">No catalogs yet.</p>}
      </div>
    </div>
  )
}
