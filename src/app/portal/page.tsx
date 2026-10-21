import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { CLIENT_STATUS_LABELS } from '@/lib/order-workflow'
import { listCompanyCatalogs } from '@/lib/catalogs/company-catalogs'

function getStatusChipClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes('complete') || s.includes('delivered') || s.includes('dispatch') || s.includes('ready')) {
    return 'bg-[#DAE6D3] text-[#3A4537] border-[#3A4537]/40'
  }
  if (s.includes('progress') || s.includes('produc') || s.includes('review') || s.includes('submit')) {
    return 'bg-[#FFDBCB] text-[#783100] border-[#9E4300]'
  }
  if (s.includes('cancel') || s.includes('reject') || s.includes('fail')) {
    return 'bg-[#FFDAD6] text-[#93000A] border-[#BA1A1A]'
  }
  return 'bg-[#F1EEE7] text-[#4A4640] border-[#CCC5BD]'
}

export default async function PortalHomePage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const [{ data: orders }, { data: quotes }, catalogs] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, status, order_value, campaign:campaign_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('quotations')
      .select('id, quotation_number, status, total')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(5),
    listCompanyCatalogs(supabase, companyId),
  ])

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9E4300]">
            CORPORATE DESK
          </div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-3xl font-normal tracking-tight text-[#1C1C18] sm:text-4xl">
            Client Portal
          </h1>
          <p className="mt-1 text-sm text-[#4A4640] sm:text-base">
            Your catalogs, quotes, and orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/portal/quote-basket"
            className="inline-flex items-center justify-center rounded-none bg-[#000000] px-4 py-2.5 sv2-label text-[11px] text-white transition-colors hover:bg-[#9E4300]"
          >
            Quote basket
          </Link>
          <Link
            href="/portal/gifts"
            className="inline-flex items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-4 py-2.5 sv2-label text-[11px] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC]"
          >
            Browse gifts
          </Link>
        </div>
      </div>

      {/* 3 Stat Cells: square hairline boxes with mono numbers */}
      <div className="grid grid-cols-1 gap-px border border-[#CCC5BD] bg-[#CCC5BD] sm:grid-cols-3">
        <Link
          href="/portal/gifts?tab=catalogs"
          className="group flex flex-col justify-between bg-[#FCF9F2] p-5 transition-colors hover:bg-[#F6F3EC] sm:p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="sv2-label text-[11px] text-[#7C766F] transition-colors group-hover:text-[#1C1C18]">
              Catalogs
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F] transition-colors group-hover:text-[#9E4300]">
              →
            </span>
          </div>
          <div>
            <div className="mb-1 font-[family-name:var(--font-mono)] text-3xl font-semibold text-[#1C1C18] sm:text-4xl">
              {catalogs.length}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F]">
              Available catalogs
            </div>
          </div>
        </Link>

        <Link
          href="/portal/quotes?tab=quotes"
          className="group flex flex-col justify-between border-t border-[#CCC5BD] bg-[#FCF9F2] p-5 transition-colors hover:bg-[#F6F3EC] sm:border-t-0 sm:border-l sm:p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="sv2-label text-[11px] text-[#7C766F] transition-colors group-hover:text-[#1C1C18]">
              Open quotes
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F] transition-colors group-hover:text-[#9E4300]">
              →
            </span>
          </div>
          <div>
            <div className="mb-1 font-[family-name:var(--font-mono)] text-3xl font-semibold text-[#1C1C18] sm:text-4xl">
              {quotes?.length || 0}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F]">
              Pending or active quotes
            </div>
          </div>
        </Link>

        <Link
          href="/portal/orders"
          className="group flex flex-col justify-between border-t border-[#CCC5BD] bg-[#FCF9F2] p-5 transition-colors hover:bg-[#F6F3EC] sm:border-t-0 sm:border-l sm:p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="sv2-label text-[11px] text-[#7C766F] transition-colors group-hover:text-[#1C1C18]">
              Orders
            </span>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F] transition-colors group-hover:text-[#9E4300]">
              →
            </span>
          </div>
          <div>
            <div className="mb-1 font-[family-name:var(--font-mono)] text-3xl font-semibold text-[#1C1C18] sm:text-4xl">
              {orders?.length || 0}
            </div>
            <div className="font-[family-name:var(--font-mono)] text-xs text-[#7C766F]">
              Total order records
            </div>
          </div>
        </Link>
      </div>

      {/* My Orders Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="border border-[#CCC5BD] bg-[#F1EEE7] px-2.5 py-1 text-[11px] uppercase tracking-wider text-[#9E4300]">
              SECTION // 01
            </span>
            <h2 className="font-[family-name:var(--font-newsreader)] text-2xl font-normal tracking-tight text-[#1C1C18] sm:text-3xl">
              My orders
            </h2>
          </div>
          <Link
            href="/portal/orders"
            className="inline-flex items-center justify-center rounded-none border border-[#CCC5BD] bg-transparent px-3.5 py-1.5 sv2-label text-[11px] text-[#1C1C18] transition-colors hover:border-[#1C1B1A] hover:bg-[#F6F3EC]"
          >
            View all
          </Link>
        </div>

        <div className="divide-y divide-[#CCC5BD] border border-[#CCC5BD] bg-[#FCF9F2]">
          {(orders || []).map((o) => {
            const campaign = Array.isArray(o.campaign) ? o.campaign[0] : o.campaign
            return (
              <Link
                key={o.id}
                href={`/portal/orders/${o.id}`}
                className="group flex flex-col gap-2 border-l-[3px] border-transparent p-4 transition-colors hover:border-[#9E4300] hover:bg-[#F6F3EC] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs uppercase tracking-wider text-[#9E4300]">
                    {o.order_number}
                  </div>
                  <div className="mt-0.5 truncate font-[family-name:var(--font-newsreader)] text-base text-[#1C1C18] sm:text-lg">
                    {campaign?.name || o.order_number}
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#CCC5BD]/50 pt-2 sm:border-t-0 sm:justify-end sm:gap-6 sm:pt-0">
                  <span
                    className={`inline-block border px-2.5 py-0.5  text-[10px] uppercase tracking-wider rounded-none ${getStatusChipClass(
                      o.status,
                    )}`}
                  >
                    {CLIENT_STATUS_LABELS[o.status] || o.status}
                  </span>
                  <span className="text-right font-[family-name:var(--font-mono)] text-sm font-semibold text-[#1C1C18] sm:text-base">
                    {formatCurrency(o.order_value)}
                  </span>
                  <span className="hidden font-[family-name:var(--font-mono)] text-xs text-[#7C766F] transition-colors group-hover:text-[#9E4300] sm:inline">
                    →
                  </span>
                </div>
              </Link>
            )
          })}
          {(!orders || orders.length === 0) && (
            <div className="py-12 text-center">
              <p className="text-xs uppercase tracking-wider text-[#7C766F]">
                No orders yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
