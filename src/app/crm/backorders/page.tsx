import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { dispatchPendingStockAlerts } from '@/lib/catalogue/stock-alerts'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

const STATUSES = ['all', 'open', 'accepted', 'declined', 'converted'] as const

type Line = { product_name: string | null; sku: string | null; quantity: number | null }
type RequestRow = {
  id: string
  full_name: string | null
  email: string | null
  company_name: string | null
  needed_by: string | null
  notify_opt_in: boolean | null
  status: string | null
  created_at: string | null
  lines?: Line[] | null
}

export default async function BackordersPage(props: { searchParams: Promise<{ status?: string }> }) {
  await requireStaff(['admin', 'sales', 'operations', 'management'])
  try {
    await dispatchPendingStockAlerts()
  } catch (err) {
    console.error('[stock-alert]', err instanceof Error ? err.message : err)
  }

  const { status: statusParam } = await props.searchParams
  const statusFilter = STATUSES.includes(statusParam as (typeof STATUSES)[number]) ? statusParam || 'all' : 'all'
  const supabase = await createClient()
  let query = supabase
    .from('store_backorder_requests')
    .select('id, full_name, email, company_name, needed_by, notify_opt_in, status, created_at, lines:store_backorder_lines(product_name, sku, quantity)')
    .order('created_at', { ascending: false })
  if (statusFilter !== 'all') query = query.eq('status', statusFilter)
  const listed = await query

  if (listed.error && /store_backorder|schema cache/i.test(listed.error.message)) {
    return (
      <div className="max-w-3xl">
        <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] font-normal text-[#1C1B1A]">Backorders</h1>
        <p className="mt-3 text-sm text-[#4A4640]">
          Apply supabase/migrations/20261030_store_backorders.sql before this list can load.
        </p>
      </div>
    )
  }

  const rows = (listed.data || []) as RequestRow[]

  return (
    <div>
      <div className="mb-6 border-b border-[#CCC5BD] pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            Backorders
          </h1>
          <span className="font-mono text-xs text-[#7C766F]">[ {rows.length} ]</span>
        </div>
        <p className="mt-1 text-sm text-[#4A4640]">Store gifts that were not in stock. Accept, decline, or turn one into a quotation.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-[#CCC5BD] pb-2">
        {STATUSES.map((status) => (
          <Link
            key={status}
            href={status === 'all' ? '/crm/backorders' : `/crm/backorders?status=${status}`}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${
              statusFilter === status ? 'bg-[#1C1B1A] text-[#FCF9F2]' : 'text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {status}
          </Link>
        ))}
      </div>

      {listed.error ? <p className="text-sm text-[#BA1A1A]">{listed.error.message}</p> : null}
      {rows.length === 0 && !listed.error ? (
        <p className="py-16 text-center text-sm text-[#4A4640]">No arrangement requests.</p>
      ) : (
        <ul className="divide-y divide-[#CCC5BD] border-y border-[#CCC5BD]">
          {rows.map((row) => {
            const lines = row.lines || []
            return (
              <li key={row.id}>
                <Link href={`/crm/backorders/${row.id}`} className="grid gap-2 px-1 py-4 hover:bg-[#F6F3EC] sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-[#1C1B1A]">{row.full_name || 'Customer'}</p>
                    <p className="text-xs text-[#4A4640]">
                      {[row.email, row.company_name].filter(Boolean).join(' · ')}
                    </p>
                    <p className="mt-1 text-sm text-[#1C1B1A]">
                      {lines.map((line) => `${line.quantity || 1} × ${line.product_name || line.sku || 'Item'}`).join(' · ') || 'No lines'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">{row.status || 'open'}</p>
                    <p className="mt-1 font-mono text-xs text-[#4A4640]">
                      {row.needed_by ? `Needed ${formatDate(row.needed_by)}` : formatDate(row.created_at)}
                      {row.notify_opt_in ? ' · Notify' : ''}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
