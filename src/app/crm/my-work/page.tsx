import { createClient } from '@/lib/supabase/server'
import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { formatCurrency, formatDate, oneRelation, asRows } from '@/lib/utils'
import { ORDER_STATUS_LABELS, orderHealth, HEALTH_LABELS, HEALTH_STYLES } from '@/lib/order-workflow'
import { isOrderSource, ORDER_SOURCE_LABELS, ORDER_SOURCES } from '@/lib/orders/source'
import Link from 'next/link'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

type NamedCompany = { name: string | null }
type WorkLead = {
  id: string
  stage: string
  estimated_value: number | null
  created_at: string
  company?: NamedCompany | NamedCompany[] | null
}
type WorkRequirement = {
  id: string
  name: string
  status: string
  deadline: string | null
  created_at: string
}
type WorkQuote = {
  id: string
  quotation_number: string | null
  status: string | null
  total: number | null
  created_at: string
}
type WorkOrder = {
  id: string
  order_number: string | null
  status: string
  expected_delivery_date: string | null
  stage_due_at: string | null
  order_value: number | null
  source?: string | null
  next_action: string | null
  created_at: string
  company?: NamedCompany | NamedCompany[] | null
}
type WorkTask = {
  id: string
  title: string
  due_at: string | null
  status: string | null
  priority: string | null
  order_id: string | null
  completed_at: string | null
  created_at: string
  orders?: { order_number: string | null } | { order_number: string | null }[] | null
}

function workHref(period: string, source: string) {
  const params = new URLSearchParams()
  if (period && period !== 'today') params.set('filter', period)
  if (source && source !== 'all') params.set('source', source)
  const query = params.toString()
  return query ? `/crm/my-work?${query}` : '/crm/my-work'
}

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
] as const

function healthChip(health: string) {
  switch (health) {
    case 'delayed':
      return 'bg-[#BA1A1A]/10 text-[#BA1A1A] border border-[#BA1A1A]/40'
    case 'at_risk':
      return 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30'
    case 'on_track':
    default:
      return 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20'
  }
}

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; source?: string }>
}) {
  const profile = await requireStaff()
  const { filter: filterParam, source: sourceParam } = await searchParams
  const filter = filterParam || 'today'
  const sourceFilter = isOrderSource(sourceParam) ? sourceParam : 'all'
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date()
  monthStart.setDate(1)
  const weekIso = weekStart.toISOString().slice(0, 10)
  const monthIso = monthStart.toISOString().slice(0, 10)

  let myOrderQuery = supabase
    .from('orders')
    .select('id, order_number, status, source, expected_delivery_date, stage_due_at, order_value, next_action, created_at, company:companies(name)')
    .order('expected_delivery_date', { ascending: true })
  if (sourceFilter !== 'all') myOrderQuery = myOrderQuery.eq('source', sourceFilter)
  if (profile.role === 'sales') {
    myOrderQuery = myOrderQuery.or(`owner_id.eq.${profile.id},assigned_to.eq.${profile.id}`)
  } else {
    myOrderQuery = myOrderQuery.or(`assigned_to.eq.${profile.id},operations_user_id.eq.${profile.id}`)
  }

  const [{ data: tasks }, { data: orders }, { data: leads }, { data: requirements }, { data: quotations }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, due_at, status, priority, order_id, completed_at, created_at, orders(order_number)')
      .eq('assigned_to', profile.id)
      .order('due_at', { ascending: true }),
    myOrderQuery,
    applyOwnerScope(supabase.from('leads').select('id, stage, estimated_value, created_at, company:companies(name)').order('created_at', { ascending: false }).limit(20), profile),
    applyOwnerScope(supabase.from('requirements').select('id, name, status, deadline, created_at').order('created_at', { ascending: false }).limit(20), profile),
    applyOwnerScope(supabase.from('quotations').select('id, quotation_number, status, total, created_at').order('created_at', { ascending: false }).limit(20), profile),
  ])

  const inRange = (iso?: string | null) => {
    if (!iso) return filter !== 'overdue' && filter !== 'completed'
    const d = iso.slice(0, 10)
    if (filter === 'today') return d === today
    if (filter === 'week') return d >= weekIso
    if (filter === 'month') return d >= monthIso
    return true
  }

  const taskRows = asRows<WorkTask>(tasks)
  const leadRows = asRows<WorkLead>(leads)
  const requirementRows = asRows<WorkRequirement>(requirements)
  const quoteRows = asRows<WorkQuote>(quotations)
  const openTasks = taskRows.filter((t: WorkTask) => t.status !== 'done' && !t.completed_at)
  const completedTasks = taskRows.filter((t: WorkTask) => t.status === 'done' || t.completed_at)
  const overdueTasks = openTasks.filter((t: WorkTask) => t.due_at && t.due_at < today)
  const myOrders = asRows<WorkOrder>(orders)
  const overdueOrders = myOrders.filter((o: WorkOrder) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'delayed')

  const visibleTasks =
    filter === 'completed' ? completedTasks :
    filter === 'overdue' ? overdueTasks :
    openTasks.filter((t) => inRange(t.due_at || t.created_at))

  const visibleOrders =
    filter === 'completed' ? myOrders.filter((o) => o.status === 'delivered') :
    filter === 'overdue' ? overdueOrders :
    myOrders.filter((o) => inRange(o.created_at || o.expected_delivery_date))

  const visibleLeads = leadRows.filter((l: WorkLead) => filter === 'completed' ? ['client', 'regular_client'].includes(l.stage) : inRange(l.created_at))
  const visibleReqs = requirementRows.filter((r: WorkRequirement) => filter === 'completed' ? r.status !== 'active' : inRange(r.created_at || r.deadline))
  const visibleQuotes = quoteRows.filter((q: WorkQuote) => filter === 'completed' ? q.status === 'accepted' : inRange(q.created_at))

  const Section = ({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) => (
    <section className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-hidden">
      <div className="px-5 py-3 border-b border-[#CCC5BD] bg-[#F6F3EC] flex items-center justify-between">
        <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
          {title}
        </h2>
        {count !== undefined ? (
          <span className="font-mono text-xs text-[#7C766F]">[ {count} ]</span>
        ) : null}
      </div>
      <div className="p-4 sm:p-5 space-y-2.5">
        {children}
      </div>
    </section>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            My Work
          </h1>
          <p className="mt-1 text-xs text-[#4A4640]">Assigned work for {profile.full_name || profile.email}.</p>
        </div>
      </div>

      {/* Mobile Filter Bar */}
      <div className="md:hidden">
        <MobileFilterBar
          pathname="/crm/my-work"
          fields={[
            {
              key: 'filter',
              label: 'Period',
              value: filter === 'today' ? '' : filter,
              emptyLabel: 'Today',
              options: [
                { value: '', label: 'Today' },
                ...FILTERS.filter((f) => f.id !== 'today').map((f) => ({ value: f.id, label: f.label })),
              ],
            },
            {
              key: 'source',
              label: 'Source',
              value: sourceFilter === 'all' ? '' : sourceFilter,
              emptyLabel: 'All sources',
              options: [
                { value: '', label: 'All sources' },
                ...ORDER_SOURCES.map((source) => ({ value: source, label: ORDER_SOURCE_LABELS[source] })),
              ],
            },
          ]}
        />
      </div>

      {/* Desktop Filters */}
      <div className="hidden flex-wrap gap-2 border-b border-[#CCC5BD] pb-2 md:flex">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={workHref(f.id, sourceFilter)}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
              filter === f.id
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="hidden flex-wrap gap-2 md:flex">
        <Link
          href={workHref(filter, 'all')}
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            sourceFilter === 'all' ? 'bg-[#806A50] text-[#FFFFFF]' : 'border bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          All sources
        </Link>
        {ORDER_SOURCES.map((source) => (
          <Link
            key={source}
            href={workHref(filter, source)}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              sourceFilter === source ? 'bg-[#806A50] text-[#FFFFFF]' : 'border bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {ORDER_SOURCE_LABELS[source]}
          </Link>
        ))}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Leads</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#1C1B1A]">{leadRows.length}</p>
        </div>
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Requirements</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#1C1B1A]">{requirementRows.length}</p>
        </div>
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quotations</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#1C1B1A]">{quoteRows.length}</p>
        </div>
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Orders</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#1C1B1A]">{myOrders.length}</p>
        </div>
      </div>

      {/* Tasks Section */}
      <Section title="My tasks" count={visibleTasks.length}>
        {visibleTasks.length === 0 && <p className="text-sm text-[#7C766F] py-2">No tasks in this view.</p>}
        {visibleTasks.map((t: WorkTask) => {
          const ord = oneRelation(t.orders)
          return (
            <Link
              key={t.id}
              href={t.order_id ? `/crm/orders/${t.order_id}` : '/crm/tasks'}
              className="block p-3.5 rounded-none bg-[#FCF9F2] border border-[#CCC5BD] hover:bg-[#F6F3EC] transition-colors"
            >
              <p className="text-sm font-semibold text-[#1C1B1A]">{t.title}</p>
              <p className="text-[11px] text-[#7C766F] mt-1">
                <span className="font-mono">{ord?.order_number || 'Task'}</span> · due <span className="font-mono">{formatDate(t.due_at)}</span>
              </p>
            </Link>
          )
        })}
      </Section>

      {/* Orders Section */}
      <Section title="My orders" count={visibleOrders.length}>
        {visibleOrders.length === 0 && <p className="text-sm text-[#7C766F] py-2">No orders in this view.</p>}
        {visibleOrders.map((o: WorkOrder) => {
          const company = oneRelation(o.company)
          const health = orderHealth(o.status, o.expected_delivery_date, o.stage_due_at)
          return (
            <Link
              key={o.id}
              href={`/crm/orders/${o.id}`}
              className="flex items-center justify-between p-3.5 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] hover:bg-[#F6F3EC] transition-colors gap-3"
            >
              <div>
                <p className="text-sm font-semibold font-mono text-[#1C1B1A]">
                  {o.order_number}
                  <span className="ml-2 px-2 py-0.5 border border-[#CCC5BD] bg-[#F6F3EC] text-[10px] font-medium text-[#4A4640] font-sans uppercase tracking-[0.08em]">
                    {isOrderSource(o.source) ? ORDER_SOURCE_LABELS[o.source] : 'CRM'}
                  </span>
                </p>
                <p className="text-[11px] text-[#4A4640] mt-0.5">
                  {company?.name} · {ORDER_STATUS_LABELS[o.status] || o.status} · <span className="font-mono">{formatCurrency(o.order_value)}</span>
                </p>
              </div>
              <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] rounded-none shrink-0 ${healthChip(health)}`}>
                {HEALTH_LABELS[health]}
              </span>
            </Link>
          )
        })}
      </Section>

      {/* Sales / Management / Admin Sections */}
      {(profile.role === 'sales' || profile.role === 'admin' || profile.role === 'management') && (
        <>
          <Section title="My leads" count={visibleLeads.length}>
            {visibleLeads.length === 0 && <p className="text-sm text-[#7C766F] py-2">No leads in this view.</p>}
            {visibleLeads.map((l: WorkLead) => {
              const company = oneRelation(l.company)
              return (
                <Link
                  key={l.id}
                  href={`/crm/leads/${l.id}`}
                  className="block rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5 text-sm hover:bg-[#F6F3EC] transition-colors"
                >
                  <p className="font-semibold text-[#1C1B1A]">{company?.name || 'Lead'}</p>
                  <p className="mt-1 text-[11px] text-[#7C766F]">{l.stage} · <span className="font-mono">{formatCurrency(l.estimated_value)}</span></p>
                </Link>
              )
            })}
          </Section>
          <Section title="My requirements" count={visibleReqs.length}>
            {visibleReqs.length === 0 && <p className="text-sm text-[#7C766F] py-2">No requirements in this view.</p>}
            {visibleReqs.map((r: WorkRequirement) => (
              <Link
                key={r.id}
                href={`/crm/requirements/${r.id}`}
                className="block rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5 text-sm hover:bg-[#F6F3EC] transition-colors"
              >
                <p className="font-semibold text-[#1C1B1A]">{r.name}</p>
                <p className="mt-1 text-[11px] text-[#7C766F]">{r.status}</p>
              </Link>
            ))}
          </Section>
          <Section title="My quotations" count={visibleQuotes.length}>
            {visibleQuotes.length === 0 && <p className="text-sm text-[#7C766F] py-2">No quotations in this view.</p>}
            {visibleQuotes.map((q: WorkQuote) => (
              <Link
                key={q.id}
                href={`/crm/quotations/${q.id}`}
                className="block rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5 text-sm hover:bg-[#F6F3EC] transition-colors"
              >
                <p className="font-mono font-semibold text-[#1C1B1A]">{q.quotation_number}</p>
                <p className="mt-1 text-[11px] text-[#7C766F]">{q.status} · <span className="font-mono">{formatCurrency(q.total)}</span></p>
              </Link>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}
