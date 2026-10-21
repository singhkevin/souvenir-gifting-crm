import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatCurrency, formatDate } from '@/lib/utils'

function requestStatusChip(status: string | null) {
  const norm = String(status || '').toLowerCase()
  if (norm === 'fulfilled') {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
        Fulfilled
      </span>
    )
  }
  if (norm === 'quoting' || norm === 'new') {
    return (
      <span className="inline-block border border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
        {norm === 'quoting' ? 'Under Review' : 'Received'}
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#4A4640] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
      {norm ? norm.replace('_', ' ') : '—'}
    </span>
  )
}

function quoteStatusChip(status: string | null) {
  const norm = String(status || 'sent').toLowerCase()
  if (norm === 'accepted') {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
        Accepted
      </span>
    )
  }
  if (norm === 'rejected') {
    return (
      <span className="inline-block border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
        Declined
      </span>
    )
  }
  if (norm === 'sent' || norm === 'viewed') {
    return (
      <span className="inline-block border border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
        Awaiting Decision
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#4A4640] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-none">
      {norm}
    </span>
  )
}

function dateLabel(value: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return format(new Date(value), 'dd MMM yyyy')
}

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = '' } = await searchParams
  const showQuotes = tab === 'quotes'
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')

  const [{ data: requirements }, quotationsResult] = await Promise.all([
    supabase
      .from('requirements')
      .select('id, name, purpose, status, budget_per_unit, quantity, deadline, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false }),
    companyId
      ? supabase
          .from('quotations')
          .select('id, quotation_number, status, total, valid_until, created_at')
          .eq('company_id', companyId)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as { id: string; quotation_number: string | null; status: string | null; total: number | null; valid_until: string | null; created_at: string | null }[] }),
  ])
  const quotations = quotationsResult.data || []

  return (
    <div className="space-y-8 min-w-0">
      {/* Page Header */}
      <div className="border-b border-[#CCC5BD] pb-6">
        <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
          Client portal // Quotes
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C18] tracking-tight">Quotes & Requests</h1>
        <p className="mt-2 text-sm text-[#4A4640]">Requests you have sent, and quotes ready for your decision.</p>
      </div>

      {/* Segmented Switcher */}
      <div className="inline-flex border border-[#CCC5BD] bg-[#F6F3EC] p-0.5 rounded-none">
        <Link
          href="/portal/quotes"
          className={`inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
            !showQuotes ? 'bg-[#1C1B1A] text-white' : 'text-[#4A4640] hover:text-[#1C1C18]'
          }`}
          aria-current={!showQuotes ? 'page' : undefined}
        >
          Requests ({requirements?.length || 0})
        </Link>
        <Link
          href="/portal/quotes?tab=quotes"
          className={`inline-flex items-center px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
            showQuotes ? 'bg-[#1C1B1A] text-white' : 'text-[#4A4640] hover:text-[#1C1C18]'
          }`}
          aria-current={showQuotes ? 'page' : undefined}
        >
          Quotations ({quotations.length})
        </Link>
      </div>

      {/* Content */}
      {showQuotes ? <QuoteList quotations={quotations} /> : <RequestList requirements={requirements || []} />}
    </div>
  )
}

function RequestList({
  requirements,
}: {
  requirements: {
    id: string
    name: string | null
    purpose: string | null
    status: string | null
    budget_per_unit: number | null
    quantity: number | null
    deadline: string | null
    created_at: string | null
  }[]
}) {
  if (requirements.length === 0) {
    return (
      <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-8 text-center text-xs text-[#7C766F] rounded-none">
        No requests yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop / Tablet Table */}
      <div className="hidden sm:block border border-[#CCC5BD] bg-white rounded-none overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              <th className="py-3 px-4">Requirement Name</th>
              <th className="py-3 px-4">Occasion / Purpose</th>
              <th className="py-3 px-4 text-right">Budget/Unit</th>
              <th className="py-3 px-4 text-right">Quantity</th>
              <th className="py-3 px-4">Deadline</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs">
            {requirements.map((req) => (
              <tr key={req.id} className="hover:bg-[#F6F3EC] transition-colors">
                <td className="py-3.5 px-4 font-medium text-[#1C1C18]">
                  {req.name || 'Untitled Request'}
                </td>
                <td className="py-3.5 px-4 text-[#4A4640]">
                  {req.purpose || '—'}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1C1C18]">
                  {req.budget_per_unit ? formatCurrency(req.budget_per_unit) : '—'}
                </td>
                <td className="py-3.5 px-4 text-right font-mono text-[#1C1C18]">
                  {req.quantity ? req.quantity.toLocaleString('en-IN') : '—'}
                </td>
                <td className="py-3.5 px-4 font-mono text-[#4A4640] whitespace-nowrap">
                  {dateLabel(req.deadline)}
                </td>
                <td className="py-3.5 px-4 font-mono text-[#7C766F] whitespace-nowrap">
                  {dateLabel(req.created_at)}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  {requestStatusChip(req.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked View */}
      <div className="sm:hidden border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
        {requirements.map((req) => (
          <article key={req.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-serif text-lg text-[#1C1C18] truncate">{req.name || 'Untitled Request'}</p>
                {req.purpose && <p className="text-xs text-[#7C766F] mt-0.5">{req.purpose}</p>}
              </div>
              {requestStatusChip(req.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#CCC5BD]">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Budget/Unit</span>
                <span className="font-mono text-xs text-[#1C1C18] font-medium">
                  {req.budget_per_unit ? formatCurrency(req.budget_per_unit) : '—'}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Quantity</span>
                <span className="font-mono text-xs text-[#1C1C18] font-medium">
                  {req.quantity ? req.quantity.toLocaleString('en-IN') : '—'}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Deadline</span>
                <span className="font-mono text-xs text-[#4A4640]">{dateLabel(req.deadline)}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Created</span>
                <span className="font-mono text-xs text-[#7C766F]">{dateLabel(req.created_at)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function QuoteList({
  quotations,
}: {
  quotations: {
    id: string
    quotation_number: string | null
    status: string | null
    total: number | null
    valid_until: string | null
    created_at: string | null
  }[]
}) {
  if (quotations.length === 0) {
    return (
      <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-8 text-center text-xs text-[#7C766F] rounded-none">
        No quotes yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Desktop / Tablet Table */}
      <div className="hidden sm:block border border-[#CCC5BD] bg-white rounded-none overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[650px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              <th className="py-3 px-4">Quotation #</th>
              <th className="py-3 px-4">Date Issued</th>
              <th className="py-3 px-4">Valid Until</th>
              <th className="py-3 px-4 text-right">Total (incl. GST)</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs">
            {quotations.map((quote) => (
              <tr key={quote.id} className="hover:bg-[#F6F3EC] transition-colors">
                <td className="py-3.5 px-4 font-mono font-semibold text-[#1C1C18] whitespace-nowrap">
                  {quote.quotation_number}
                </td>
                <td className="py-3.5 px-4 font-mono text-[#7C766F] whitespace-nowrap">
                  {formatDate(quote.created_at)}
                </td>
                <td className="py-3.5 px-4 font-mono text-[#4A4640] whitespace-nowrap">
                  {formatDate(quote.valid_until)}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#1C1C18] whitespace-nowrap">
                  {formatCurrency(quote.total)}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {quoteStatusChip(quote.status)}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <Link
                    href={`/portal/quotes/${quote.id}`}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300] transition-colors rounded-none"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked View */}
      <div className="sm:hidden border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
        {quotations.map((quote) => (
          <article key={quote.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-sm font-bold text-[#1C1C18] block">
                  {quote.quotation_number}
                </span>
                <p className="font-mono text-xs text-[#7C766F] mt-0.5">
                  Issued {formatDate(quote.created_at)} · Valid {formatDate(quote.valid_until)}
                </p>
              </div>
              {quoteStatusChip(quote.status)}
            </div>

            <div className="flex items-baseline justify-between pt-2 border-t border-[#CCC5BD]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">
                Total (incl. GST)
              </span>
              <span className="font-mono text-base font-bold text-[#1C1C18]">
                {formatCurrency(quote.total)}
              </span>
            </div>

            <Link
              href={`/portal/quotes/${quote.id}`}
              className="inline-flex w-full items-center justify-center px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] border border-[#1C1B1A] bg-[#1C1B1A] text-white hover:bg-[#9E4300] hover:border-[#9E4300] transition-colors rounded-none"
            >
              View quotation
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}
