import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { formatCurrency, formatDate } from '@/lib/utils'

function requestStatusClass(status: string | null) {
  if (status === 'new') return 'bg-blue-100 text-blue-800'
  if (status === 'quoting') return 'bg-yellow-100 text-yellow-800'
  if (status === 'fulfilled') return 'bg-green-100 text-green-800'
  return 'bg-gray-100 text-gray-800'
}

function quoteStatusClass(status: string | null) {
  if (status === 'accepted') return 'bg-green-100 text-green-800'
  if (status === 'rejected') return 'bg-red-100 text-red-800'
  if (status === 'sent') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-800'
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Quotes & requests</h1>
        <p className="mt-2 text-sm text-gray-600">Requests you have sent, and quotes waiting for a decision.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/portal/quotes" className={tabClass(!showQuotes)} aria-current={!showQuotes ? 'page' : undefined}>
          Requests
        </Link>
        <Link href="/portal/quotes?tab=quotes" className={tabClass(showQuotes)} aria-current={showQuotes ? 'page' : undefined}>
          Quotes
        </Link>
      </div>

      {showQuotes ? <QuoteList quotations={quotations} /> : <RequestList requirements={requirements || []} />}
    </div>
  )
}

function tabClass(active: boolean) {
  return `inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium ${
    active ? 'bg-primary/5 text-primary' : 'text-gray-600 hover:bg-gray-50'
  }`
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
    return <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">No requests yet.</p>
  }
  return (
    <div className="space-y-3">
      {requirements.map((req) => (
        <article key={req.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{req.name}</p>
              <p className="mt-0.5 text-xs text-gray-500">{req.purpose}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${requestStatusClass(req.status)}`}>
              {String(req.status || '').replace('_', ' ').toUpperCase() || '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Budget/unit</p>
              <p className="mt-0.5 font-medium text-gray-900">{formatCurrency(req.budget_per_unit)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Quantity</p>
              <p className="mt-0.5 font-medium text-gray-900">{req.quantity}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Deadline</p>
              <p className="mt-0.5 font-medium text-gray-900">{dateLabel(req.deadline)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-400">Created</p>
              <p className="mt-0.5 font-medium text-gray-900">{dateLabel(req.created_at)}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function dateLabel(value: string | null) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—'
  return format(new Date(value), 'MMM dd, yyyy')
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
    return <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">No quotes yet.</p>
  }
  return (
    <div className="space-y-3">
      {quotations.map((quote) => (
        <article key={quote.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-sm font-semibold text-gray-900">{quote.quotation_number}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(quote.created_at)} · valid {formatDate(quote.valid_until)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${quoteStatusClass(quote.status)}`}>
              {(quote.status || 'sent').toUpperCase()}
            </span>
          </div>
          <p className="text-base font-semibold text-gray-900">{formatCurrency(quote.total)}</p>
          <Link
            href={`/portal/quotes/${quote.id}`}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#806A50] px-3 text-xs font-semibold text-white hover:bg-[#9C8567] sm:w-auto"
          >
            View quote
          </Link>
        </article>
      ))}
    </div>
  )
}
