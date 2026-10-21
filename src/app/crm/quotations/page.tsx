import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { FileText } from 'lucide-react'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

const STATUSES = ['all', 'draft', 'sent', 'accepted', 'rejected', 'expired']

type QuotationRow = {
  id: string
  quotation_number: string | null
  status: string | null
  total: number | null
  valid_until: string | null
  created_at: string
  company: { id: string; name: string } | { id: string; name: string }[] | null
  requirement: { id: string; name: string } | { id: string; name: string }[] | null
  owner: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null
}

function one<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function QuotationStatusChip({ status }: { status: string | null }) {
  const s = status || 'draft'
  if (s === 'accepted') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 font-mono text-[11px] uppercase text-[#3A4537]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> accepted
      </span>
    )
  }
  if (s === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 font-mono text-[11px] uppercase text-[#9E4300]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9E4300]" /> sent
      </span>
    )
  }
  if (s === 'rejected' || s === 'expired') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 px-2 py-0.5 font-mono text-[11px] uppercase text-[#BA1A1A]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> {s}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] px-2 py-0.5 font-mono text-[11px] uppercase text-[#4A4640]">
      {s}
    </span>
  )
}

export default async function QuotationsPage(props: {
  searchParams: Promise<{ status?: string; q?: string; owner?: string }>
}) {
  const { status = 'all', q = '', owner = 'all' } = await props.searchParams
  const profile = await requireStaff()
  const supabase = await createClient()

  let query = supabase
    .from('quotations')
    .select(
      'id, quotation_number, status, total, valid_until, created_at, company:companies(id, name), requirement:requirements!requirement_id(id, name), owner:profiles!owner_id(id, full_name)'
    )
    .order('created_at', { ascending: false })
    .limit(100)
  query = applyOwnerScope(query, profile)

  if (status !== 'all') query = query.eq('status', status)
  if (owner === 'mine' || profile.role === 'sales') query = query.eq('owner_id', profile.id)
  else if (owner !== 'all') query = query.eq('owner_id', owner)
  if (q.trim()) query = query.ilike('quotation_number', `%${q.trim()}%`)

  let acceptedQuery = applyOwnerScope(supabase.from('quotations').select('id', { count: 'exact', head: true }).eq('status', 'accepted'), profile)
  let totalQuery = applyOwnerScope(supabase.from('quotations').select('id', { count: 'exact', head: true }), profile)

  const [{ data: quotations, error }, { count: acceptedCount }, { count: totalCount }] = await Promise.all([
    query,
    acceptedQuery,
    totalQuery,
  ])

  const rows = (quotations || []) as unknown as QuotationRow[]
  const conversion = totalCount ? Math.round(((acceptedCount || 0) / totalCount) * 100) : 0
  const pipelineValue = rows.reduce((sum, r) => sum + Number(r.total || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            Quotations
          </h1>
          <p className="mt-1 text-xs text-[#4A4640]">
            <span className="font-mono">{totalCount || 0}</span> total · <span className="font-mono">{conversion}%</span> accepted · <span className="font-mono">{formatCurrency(pipelineValue)}</span> in this view
          </p>
        </div>
        <Link
          href="/crm/requirements"
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
        >
          <FileText size={14} /> Open a requirement to quote
        </Link>
      </div>

      {error && (
        <div className="rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 p-3 text-xs text-[#BA1A1A]">
          Could not load quotations: {error.message}
        </div>
      )}

      <div className="space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3 sm:p-4">
        <form action="/crm/quotations" className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="owner" value={owner} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search quote number..."
            className="min-h-9 min-w-0 flex-1 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
          <button
            type="submit"
            className="min-h-9 shrink-0 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
          >
            Search
          </button>
        </form>

        <div className="md:hidden">
          <MobileFilterBar
            pathname="/crm/quotations"
            preserveParams={q ? { q } : {}}
            fields={[
              {
                key: 'status',
                label: 'Status',
                value: status,
                emptyLabel: 'All',
                options: STATUSES.map((s) => ({ value: s, label: s === 'all' ? 'All' : s })),
              },
              {
                key: 'owner',
                label: 'Owner',
                value: owner,
                emptyLabel: 'All',
                options: [
                  { value: 'all', label: 'All quotations' },
                  { value: 'mine', label: 'My quotations' },
                ],
              },
            ]}
          />
        </div>

        <div className="hidden flex-wrap items-center gap-1.5 border-t border-[#CCC5BD] pt-3 md:flex">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/crm/quotations?status=${s}${owner !== 'all' ? `&owner=${owner}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-none px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
                status === s
                  ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                  : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
              }`}
            >
              {s}
            </Link>
          ))}
          <Link
            href={`/crm/quotations?status=${status}&owner=${owner === 'mine' ? 'all' : 'mine'}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`ml-auto rounded-none px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] transition-colors ${
              owner === 'mine'
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            My quotations
          </Link>
        </div>
      </div>

      {/* Desktop Quotations Table */}
      <div className="hidden overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2] md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quote #</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Requirement</th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total (₹)</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid Until</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {rows.map((quote) => {
              const company = one(quote.company)
              const requirement = one(quote.requirement)
              const quoteOwner = one(quote.owner)
              const expired =
                quote.valid_until &&
                new Date(quote.valid_until) < new Date() &&
                !['accepted', 'rejected'].includes(quote.status || '')

              return (
                <tr key={quote.id} className="transition-colors hover:bg-[#F6F3EC]">
                  <td className="px-3.5 py-2.5">
                    <Link
                      href={`/crm/quotations/${quote.id}`}
                      className="font-mono font-medium text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                    >
                      {quote.quotation_number || quote.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {company ? (
                      <Link
                        href={`/crm/companies/${company.id}`}
                        className="text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                      >
                        {company.name}
                      </Link>
                    ) : (
                      <span className="text-[#7C766F]">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {requirement ? (
                      <Link
                        href={`/crm/requirements/${requirement.id}`}
                        className="text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                      >
                        {requirement.name}
                      </Link>
                    ) : (
                      <span className="text-[#7C766F]">—</span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">
                    {formatCurrency(quote.total)}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <QuotationStatusChip status={quote.status} />
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span className={`font-mono ${expired ? 'font-semibold text-[#BA1A1A]' : 'text-[#4A4640]'}`}>
                      {formatDate(quote.valid_until)}
                      {expired ? ' · lapsed' : ''}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[#4A4640]">{quoteOwner?.full_name || '—'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-[#7C766F]">
                  No quotations match this view. Quotations are raised from a requirement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {rows.length > 0 ? (
          rows.map((quote) => {
            const company = one(quote.company)
            const requirement = one(quote.requirement)
            const quoteOwner = one(quote.owner)
            const expired =
              quote.valid_until &&
              new Date(quote.valid_until) < new Date() &&
              !['accepted', 'rejected'].includes(quote.status || '')

            return (
              <article key={quote.id} className="space-y-2 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/crm/quotations/${quote.id}`}
                    className="font-mono text-xs font-semibold text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    {quote.quotation_number || quote.id.slice(0, 8)}
                  </Link>
                  <QuotationStatusChip status={quote.status} />
                </div>

                <div className="font-mono text-sm font-semibold text-[#1C1B1A]">
                  {formatCurrency(quote.total)}
                </div>

                <div className="space-y-1 border-t border-[#CCC5BD] pt-2 text-xs text-[#4A4640]">
                  {company && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company: </span>
                      <Link href={`/crm/companies/${company.id}`} className="hover:text-[#9E4300]">
                        {company.name}
                      </Link>
                    </div>
                  )}
                  {requirement && (
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Requirement: </span>
                      <Link href={`/crm/requirements/${requirement.id}`} className="hover:text-[#9E4300]">
                        {requirement.name}
                      </Link>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid: </span>
                    <span className={`font-mono ${expired ? 'font-semibold text-[#BA1A1A]' : ''}`}>
                      {formatDate(quote.valid_until)}
                      {expired ? ' · lapsed' : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Owner: </span>
                    {quoteOwner?.full_name || '—'}
                  </div>
                </div>

                <div className="border-t border-[#CCC5BD] pt-2">
                  <Link
                    href={`/crm/quotations/${quote.id}`}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    View Quote →
                  </Link>
                </div>
              </article>
            )
          })
        ) : !error ? (
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center text-xs text-[#7C766F]">
            No quotations match this view. Quotations are raised from a requirement.
          </div>
        ) : null}
      </div>
    </div>
  )
}
