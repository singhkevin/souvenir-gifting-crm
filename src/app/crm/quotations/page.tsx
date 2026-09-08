import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { FileText } from 'lucide-react'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  expired: 'bg-amber-100 text-amber-800',
}

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#1A3022]">Quotations</h1>
          <p className="text-xs text-gray-500 mt-1">
            {totalCount || 0} total · {conversion}% accepted · {formatCurrency(pipelineValue)} in this view
          </p>
        </div>
        <Link
          href="/crm/requirements"
          className="bg-[#1A3022] text-white px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
        >
          <FileText size={14} /> Create from a requirement
        </Link>
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          Could not load quotations: {error.message}
        </p>
      )}

      <div className="space-y-3">
        <form action="/crm/quotations" className="flex gap-2">
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="owner" value={owner} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search quote number"
            className="min-h-10 min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button type="submit" className="min-h-10 shrink-0 rounded-lg border bg-gray-100 px-3 text-xs font-semibold">
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

        <div className="hidden flex-wrap items-center gap-2 border-b pb-2 md:flex">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/crm/quotations?status=${s}${owner !== 'all' ? `&owner=${owner}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
                status === s ? 'bg-[#1A3022] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
            </Link>
          ))}
          <Link
            href={`/crm/quotations?status=${status}&owner=${owner === 'mine' ? 'all' : 'mine'}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            className={`ml-auto rounded-full px-3 py-1.5 text-xs font-medium ${
              owner === 'mine' ? 'bg-[#1A3022] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            My quotations
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Quote #</th>
              <th className="p-4 font-medium text-gray-500">Company</th>
              <th className="p-4 font-medium text-gray-500">Requirement</th>
              <th className="p-4 font-medium text-gray-500 text-right">Total</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
              <th className="p-4 font-medium text-gray-500">Valid until</th>
              <th className="p-4 font-medium text-gray-500">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((quote) => {
              const company = one(quote.company)
              const requirement = one(quote.requirement)
              const quoteOwner = one(quote.owner)
              const expired =
                quote.valid_until &&
                new Date(quote.valid_until) < new Date() &&
                !['accepted', 'rejected'].includes(quote.status || '')
              return (
                <tr key={quote.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <Link href={`/crm/quotations/${quote.id}`} className="text-[#1A3022] hover:underline font-semibold font-mono">
                      {quote.quotation_number || quote.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="p-4">
                    {company ? (
                      <Link href={`/crm/companies/${company.id}`} className="hover:underline">
                        {company.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4">
                    {requirement ? (
                      <Link href={`/crm/requirements/${requirement.id}`} className="hover:underline">
                        {requirement.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-4 font-semibold text-right">{formatCurrency(quote.total)}</td>
                  <td className="p-4">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${
                        STATUS_COLORS[quote.status || ''] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {quote.status || 'draft'}
                    </span>
                  </td>
                  <td className={`p-4 ${expired ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                    {formatDate(quote.valid_until)}
                    {expired ? ' · lapsed' : ''}
                  </td>
                  <td className="p-4 text-gray-600">{quoteOwner?.full_name || '—'}</td>
                </tr>
              )
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No quotations match this view. Quotations are raised from a requirement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
