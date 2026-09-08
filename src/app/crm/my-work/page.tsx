import { createClient } from '@/lib/supabase/server'
import { requireStaff, applyOwnerScope } from '@/lib/auth'
import { formatCurrency, formatDate, oneRelation, asRows } from '@/lib/utils'
import { ORDER_STATUS_LABELS, orderHealth, HEALTH_LABELS, HEALTH_STYLES } from '@/lib/order-workflow'
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

const FILTERS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
] as const

export default async function MyWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const profile = await requireStaff()
  const { filter: filterParam } = await searchParams
  const filter = filterParam || 'today'
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
    .select('id, order_number, status, expected_delivery_date, stage_due_at, order_value, next_action, created_at, company:companies(name)')
    .order('expected_delivery_date', { ascending: true })
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

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="bg-white rounded-2xl border border-[#E5DFD5] p-5 space-y-3">
      <h2 className="font-serif text-lg text-[#1C1917]">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-primary)]">My Work</h1>
        <p className="text-xs text-[#7A7267] mt-1">Assigned work for {profile.full_name || profile.email}.</p>
      </div>

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
          ]}
        />
      </div>
      <div className="hidden flex-wrap gap-2 md:flex">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`/crm/my-work?filter=${f.id}`}
            className={`rounded-lg px-3 py-2 text-xs font-medium ${
              filter === f.id ? 'bg-[#1A3022] text-white' : 'border bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
        <div className="bg-white border rounded-xl p-3"><p className="text-[10px] uppercase text-[#7A7267]">Leads</p><p className="text-lg font-semibold">{leadRows.length}</p></div>
        <div className="bg-white border rounded-xl p-3"><p className="text-[10px] uppercase text-[#7A7267]">Requirements</p><p className="text-lg font-semibold">{requirementRows.length}</p></div>
        <div className="bg-white border rounded-xl p-3"><p className="text-[10px] uppercase text-[#7A7267]">Quotations</p><p className="text-lg font-semibold">{quoteRows.length}</p></div>
        <div className="bg-white border rounded-xl p-3"><p className="text-[10px] uppercase text-[#7A7267]">Orders</p><p className="text-lg font-semibold">{myOrders.length}</p></div>
      </div>

      <Section title="My tasks">
        {visibleTasks.length === 0 && <p className="text-sm text-gray-500">No tasks in this view.</p>}
        {visibleTasks.map((t: WorkTask) => {
          const ord = oneRelation(t.orders)
          return (
            <Link key={t.id} href={t.order_id ? `/crm/orders/${t.order_id}` : '/crm/tasks'} className="block p-3 rounded-xl bg-[#FAF7F2] border border-[#EFE9E0]">
              <p className="text-sm font-medium">{t.title}</p>
              <p className="text-[11px] text-[#7A7267] mt-0.5">{ord?.order_number || 'Task'} · due {formatDate(t.due_at)}</p>
            </Link>
          )
        })}
      </Section>

      <Section title="My orders">
        {visibleOrders.length === 0 && <p className="text-sm text-gray-500">No orders in this view.</p>}
        {visibleOrders.map((o: WorkOrder) => {
          const company = oneRelation(o.company)
          const health = orderHealth(o.status, o.expected_delivery_date, o.stage_due_at)
          return (
            <Link key={o.id} href={`/crm/orders/${o.id}`} className="flex items-center justify-between p-3 rounded-xl border border-[#EFE9E0] hover:bg-[#FAF7F2]">
              <div>
                <p className="text-sm font-semibold font-mono">{o.order_number}</p>
                <p className="text-[11px] text-[#7A7267]">{company?.name} · {ORDER_STATUS_LABELS[o.status] || o.status} · {formatCurrency(o.order_value)}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${HEALTH_STYLES[health]}`}>{HEALTH_LABELS[health]}</span>
            </Link>
          )
        })}
      </Section>

      {(profile.role === 'sales' || profile.role === 'admin' || profile.role === 'management') && (
        <>
          <Section title="My leads">
            {visibleLeads.length === 0 && <p className="text-sm text-gray-500">No leads in this view.</p>}
            {visibleLeads.map((l: WorkLead) => {
              const company = oneRelation(l.company)
              return (
                <Link
                  key={l.id}
                  href={`/crm/leads/${l.id}`}
                  className="block rounded-xl border border-[#EFE9E0] bg-[#FAF7F2] p-3 text-sm"
                >
                  <p className="font-medium text-gray-900">{company?.name || 'Lead'}</p>
                  <p className="mt-0.5 text-[11px] text-[#7A7267]">{l.stage} · {formatCurrency(l.estimated_value)}</p>
                </Link>
              )
            })}
          </Section>
          <Section title="My requirements">
            {visibleReqs.length === 0 && <p className="text-sm text-gray-500">No requirements in this view.</p>}
            {visibleReqs.map((r: WorkRequirement) => (
              <Link
                key={r.id}
                href={`/crm/requirements/${r.id}`}
                className="block rounded-xl border border-[#EFE9E0] bg-[#FAF7F2] p-3 text-sm"
              >
                <p className="font-medium text-gray-900">{r.name}</p>
                <p className="mt-0.5 text-[11px] text-[#7A7267]">{r.status}</p>
              </Link>
            ))}
          </Section>
          <Section title="My quotations">
            {visibleQuotes.length === 0 && <p className="text-sm text-gray-500">No quotations in this view.</p>}
            {visibleQuotes.map((q: WorkQuote) => (
              <Link
                key={q.id}
                href={`/crm/quotations/${q.id}`}
                className="block rounded-xl border border-[#EFE9E0] bg-[#FAF7F2] p-3 text-sm"
              >
                <p className="font-mono font-medium text-gray-900">{q.quotation_number}</p>
                <p className="mt-0.5 text-[11px] text-[#7A7267]">{q.status} · {formatCurrency(q.total)}</p>
              </Link>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}
