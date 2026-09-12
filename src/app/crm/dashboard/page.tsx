import { createClient } from '@/lib/supabase/server'
import { requireStaff, canSeeFinance, applyOrderScope, applyOwnerScope, applyCompanyScope, seesAllSalesRecords } from '@/lib/auth'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS, orderHealth } from '@/lib/order-workflow'
import { entityHref, describeAudit } from '@/lib/entity-href'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MobileDateRangeFilter } from '@/components/ui/mobile-filter-sheet'

function Card({ label, value, href, warn }: { label: string; value: string | number; href?: string; warn?: boolean }) {
  const inner = (
    <div className={`rounded-xl border p-3 sm:p-4 ${warn ? 'bg-red-50 border-red-100' : 'bg-white border-[#E5DFD5]'}`}>
      <span className="text-[10px] font-semibold tracking-wider text-[#7A7267] uppercase">{label}</span>
      <p className="font-serif text-lg text-[#1C1917] mt-1.5 sm:mt-2 sm:text-xl break-words">{value}</p>
    </div>
  )
  return href ? <Link href={href} className="block hover:border-[#1A3022]">{inner}</Link> : inner
}

type DashOrder = {
  id: string
  status: string
  order_value: number | null
  expected_delivery_date: string | null
  assigned_to: string | null
  current_department_id: string | null
  stage_due_at: string | null
  owner_id: string | null
  company_id: string | null
  gross_profit: number | null
  created_at: string
}
type DashLead = { id: string; stage: string; owner_id: string | null; created_at: string; estimated_value: number | null }
type DashReq = { id: string; status: string; owner_id: string | null; created_at: string }
type DashQuote = { id: string; status: string | null; total: number | null; owner_id: string | null; created_at: string }
type DashInvoice = { id?: string; amount: number; status: string; order_id?: string | null; created_at?: string }
type DashPayable = { amount: number; status: string }
type DashTask = { id: string; status: string | null; due_at: string | null; assigned_to: string | null; completed_at: string | null; department_id?: string | null }
type DashDept = { id: string; name: string; slug?: string | null }
type DashStaff = { id: string; full_name: string | null; role: string; department_id: string | null }
type DashSample = { in_office: number | null; with_client: number | null; pending_supplier: number | null; with_team: number | null }
type DashActivity = {
  id: string
  action: string
  entity: string | null
  entity_id: string | null
  previous_value: unknown
  new_value: unknown
  created_at: string
  user_id: string | null
  profile?: { full_name: string | null } | { full_name: string | null }[] | null
}

function asList<T>(data: unknown): T[] {
  return Array.isArray(data) ? data as T[] : []
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const profile = await requireStaff()
  const { from, to } = await searchParams
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let orderQuery = applyOrderScope(
    supabase
      .from('orders')
      .select('id, status, order_value, expected_delivery_date, assigned_to, current_department_id, stage_due_at, owner_id, company_id, gross_profit, created_at'),
    profile
  )
  let leadQuery = applyOwnerScope(
    supabase.from('leads').select('id, stage, owner_id, created_at, estimated_value'),
    profile
  )
  let reqQuery = applyOwnerScope(
    supabase.from('requirements').select('id, status, owner_id, created_at'),
    profile
  )
  let quoteQuery = applyOwnerScope(
    supabase.from('quotations').select('id, status, total, owner_id, created_at'),
    profile
  )
  let companyQuery = applyCompanyScope(
    supabase.from('companies').select('id, status', { count: 'exact' }),
    profile
  )

  if (from) {
    orderQuery = orderQuery.gte('created_at', from)
    leadQuery = leadQuery.gte('created_at', from)
    reqQuery = reqQuery.gte('created_at', from)
    quoteQuery = quoteQuery.gte('created_at', from)
  }
  if (to) {
    orderQuery = orderQuery.lte('created_at', `${to}T23:59:59`)
    leadQuery = leadQuery.lte('created_at', `${to}T23:59:59`)
    reqQuery = reqQuery.lte('created_at', `${to}T23:59:59`)
    quoteQuery = quoteQuery.lte('created_at', `${to}T23:59:59`)
  }

  const [
    companies,
    campaigns,
    leads,
    requirements,
    quotations,
    orders,
    invoices,
    payables,
    departments,
    staff,
    tasks,
    followUps,
    activity,
    samples,
  ] = await Promise.all([
    companyQuery,
    supabase.from('campaigns').select('id, status', { count: 'exact' }),
    leadQuery,
    reqQuery,
    quoteQuery,
    orderQuery,
    canSeeFinance(profile.role)
      ? supabase.from('invoices').select('id, amount, status, order_id, created_at')
      : Promise.resolve({ data: [] as { amount: number; status: string; order_id?: string }[] }),
    canSeeFinance(profile.role)
      ? supabase.from('payables').select('amount, status')
      : Promise.resolve({ data: [] as { amount: number; status: string }[] }),
    supabase.from('departments').select('id, name, slug'),
    supabase.from('profiles').select('id, full_name, role, department_id').eq('is_active', true).in('role', ['admin', 'sales', 'operations', 'accounts', 'management']),
    supabase.from('tasks').select('id, status, due_at, assigned_to, completed_at, department_id'),
    supabase.from('activities').select('id, title, type, due_at, status, assigned_to').eq('assigned_to', profile.id).neq('status', 'done').order('due_at', { ascending: true }).limit(6),
    supabase
      .from('audit_logs')
      .select('id, action, entity, entity_id, previous_value, new_value, created_at, user_id, profile:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(20),
    (profile.role === 'admin' || profile.role === 'operations' || profile.role === 'management')
      ? supabase.from('sample_stock').select('in_office, with_client, pending_supplier, with_team')
      : Promise.resolve({ data: [] as { in_office: number; with_client: number; pending_supplier: number; with_team: number }[] }),
  ])

  const orderRows = asList<DashOrder>(orders.data)
  const leadRows = asList<DashLead>(leads.data)
  const reqRows = asList<DashReq>(requirements.data)
  const quoteRows = asList<DashQuote>(quotations.data)
  const invoiceRows = asList<DashInvoice>(invoices.data)
  const taskRows = asList<DashTask>(tasks.data)
  const deptRows = asList<DashDept>(departments.data)
  const staffRows = asList<DashStaff>(staff.data)
  const activityRows = asList<DashActivity>(activity.data)
  const sampleRows = asList<DashSample>(samples.data)
  const samplesOffice = sampleRows.reduce((s: number, r: DashSample) => s + Number(r.in_office || 0), 0)
  const samplesClient = sampleRows.reduce((s: number, r: DashSample) => s + Number(r.with_client || 0), 0)
  const samplesSupplier = sampleRows.reduce((s: number, r: DashSample) => s + Number(r.pending_supplier || 0), 0)
  const samplesTeam = sampleRows.reduce((s: number, r: DashSample) => s + Number(r.with_team || 0), 0)
  const samplesOut = samplesClient + samplesSupplier + samplesTeam

  const convertedStages = new Set(['client', 'regular_client'])
  const newLeads = leadRows.filter((l) => l.created_at && l.created_at >= weekAgo)
  const convertedLeads = leadRows.filter((l) => convertedStages.has(l.stage))
  const activeLeads = leadRows.filter((l) => !convertedStages.has(l.stage))
  const openReqs = reqRows.filter((r) => r.status === 'active')
  const pendingQuotes = quoteRows.filter((q) => ['draft', 'sent', 'viewed'].includes(q.status || ''))
  const wonQuotes = quoteRows.filter((q) => q.status === 'accepted')

  const totalOrderValue = orderRows.reduce((s, o) => s + Number(o.order_value || 0), 0)
  const margin = orderRows.reduce((s, o) => s + Number(o.gross_profit || 0), 0)
  const inProgress = orderRows.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const delayed = inProgress.filter((o) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'delayed')
  const atRisk = inProgress.filter((o) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'at_risk')
  const unassigned = inProgress.filter((o) => !o.assigned_to)
  const delivered = orderRows.filter((o) => o.status === 'delivered')
  const cancelled = orderRows.filter((o) => o.status === 'cancelled')
  const invoicedIds = new Set(invoiceRows.map((i) => i.order_id).filter(Boolean))
  const readyToInvoice = delivered.filter((o) => !invoicedIds.has(o.id)).length
  const won = orderRows.filter((o) => !['created', 'cancelled'].includes(o.status)).length
  const lost = reqRows.filter((r) => r.status === 'lost').length
  const quoteToOrder = quoteRows.length ? Math.round((won / quoteRows.length) * 100) : 0
  const reqToQuote = reqRows.length ? Math.round((quoteRows.length / reqRows.length) * 100) : 0
  const invoiced = invoiceRows.reduce((s, i) => s + Number(i.amount || 0), 0)
  const paid = invoiceRows.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount || 0), 0)
  const unpaid = invoiceRows.filter((i) => ['unpaid', 'issued'].includes(i.status))
  const partial = invoiceRows.filter((i) => i.status === 'partially_paid')
  const overdueInv = invoiceRows.filter((i) => i.status === 'overdue')
  const outstanding = invoiced - paid
  const payableTotal = asList<DashPayable>(payables.data).reduce((s: number, p: DashPayable) => s + Number(p.amount || 0), 0)

  const byStage = ORDER_LIFECYCLE.map((st) => {
    const rows = orderRows.filter((o) => o.status === st)
    return {
      st,
      n: rows.length,
      value: rows.reduce((s, o) => s + Number(o.order_value || 0), 0),
      overdue: rows.filter((o) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'delayed').length,
    }
  })

  const financeStages = [
    { key: 'invoice', label: 'Invoice', n: invoiceRows.length, value: invoiced, href: '/crm/invoices' },
    { key: 'payment', label: 'Payment', n: invoiceRows.filter((i) => i.status === 'paid').length, value: paid, href: '/crm/payments' },
  ]

  const deptStats = deptRows.map((d) => {
    const rows = orderRows.filter((o) => o.current_department_id === d.id)
    const active = rows.filter((o) => !['delivered', 'cancelled'].includes(o.status))
    const overdue = active.filter((o) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'delayed')
    const completed = rows.filter((o) => o.status === 'delivered')
    const unassignedDept = active.filter((o) => !o.assigned_to)
    return { ...d, active: active.length, overdue: overdue.length, completed: completed.length, unassigned: unassignedDept.length }
  })

  const people = staffRows.map((p) => {
    const assignedOrders = inProgress.filter((o) => o.assigned_to === p.id || o.owner_id === p.id)
    const ownedLeads = leadRows.filter((l) => l.owner_id === p.id)
    const ownedReqs = reqRows.filter((r) => r.owner_id === p.id)
    const ownedQuotes = quoteRows.filter((q) => q.owner_id === p.id)
    const orderValue = orderRows.filter((o) => o.owner_id === p.id || o.assigned_to === p.id).reduce((s, o) => s + Number(o.order_value || 0), 0)
    const pending = taskRows.filter((t) => t.assigned_to === p.id && t.status !== 'done' && !t.completed_at)
    const overdue = pending.filter((t) => t.due_at && t.due_at < today)
    const completed = taskRows.filter((t) => t.assigned_to === p.id && (t.status === 'done' || t.completed_at))
    return {
      ...p,
      assigned: assignedOrders.length,
      leads: ownedLeads.length,
      converted: ownedLeads.filter((l) => convertedStages.has(l.stage)).length,
      reqs: ownedReqs.length,
      quotes: ownedQuotes.length,
      orderValue,
      pending: pending.length,
      overdue: overdue.length,
      completed: completed.length,
    }
  }).filter((p) => seesAllSalesRecords(profile) || p.id === profile.id || p.department_id === profile.department_id)

  const greeting = profile.full_name?.split(' ')[0] || 'there'
  const roleTitle =
    profile.role === 'admin' ? 'Company-wide process tracking' :
    profile.role === 'management' ? 'Exceptions and performance' :
    profile.role === 'sales' ? 'My pipeline and follow-ups' :
    profile.role === 'operations' ? 'Assigned operational work' :
    profile.role === 'accounts' ? 'Invoices, collections and payables' : 'What do I need to do?'

  const ActivityFeed = () => (
    <div className="bg-white rounded-xl border border-[#E5DFD5] p-5">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-serif text-lg">Activity</h2>
        {(profile.role === 'admin' || profile.role === 'management') && (
          <Link href="/crm/audit-log" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]">Full audit log</Link>
        )}
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {activityRows.map((row) => {
          const actor = Array.isArray(row.profile) ? row.profile[0] : row.profile
          const href = entityHref(row.entity, row.entity_id)
          const inner = (
            <>
              <p className="text-sm text-[#1C1917]">
                <span className="font-semibold">{actor?.full_name || 'System'}</span>{' '}
                {describeAudit(row.action, row.entity || 'record')}
                {row.entity_id ? <span className="font-mono text-[11px] text-[#7A7267]"> #{String(row.entity_id).slice(0, 8)}</span> : null}
              </p>
              <p className="text-[11px] text-[#7A7267]">{formatDateTime(row.created_at)}</p>
            </>
          )
          return href ? (
            <Link key={row.id} href={href} className="block p-2 rounded-lg hover:bg-[#FAF7F2]">{inner}</Link>
          ) : (
            <div key={row.id} className="p-2">{inner}</div>
          )
        })}
        {activityRows.length === 0 && <p className="text-sm text-gray-500">No recent activity.</p>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl text-[#1C1917] sm:text-3xl">Good day, {greeting}</h1>
          <p className="mt-1 text-xs text-[#7A7267]">{roleTitle}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {(profile.role === 'admin' || profile.role === 'sales') && (
            <Link
              href="/crm/products/add"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#1A3022] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#274433] sm:w-auto"
            >
              <Plus size={16} />
              Add Product
            </Link>
          )}
          {(profile.role === 'admin' || profile.role === 'management') && (
            <MobileDateRangeFilter from={from || ''} to={to || ''} submitLabel="Filter" className="w-full sm:w-auto" />
          )}
        </div>
      </div>

      {(profile.role === 'admin' || profile.role === 'management') && (
        <>
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7267] mb-3">Business overview</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
              <Card label="Total leads" value={leadRows.length} href="/crm/leads" />
              <Card label="New leads" value={newLeads.length} href="/crm/leads" />
              <Card label="Active leads" value={activeLeads.length} href="/crm/leads" />
              <Card label="Converted leads" value={convertedLeads.length} href="/crm/leads?stage=client" />
              <Card label="Lost requirements" value={lost} href="/crm/requirements?status=lost" />
              <Card label="Lead conversion" value={`${leadRows.length ? Math.round((convertedLeads.length / leadRows.length) * 100) : 0}%`} />
              <Card label="Requirements" value={reqRows.length} href="/crm/requirements" />
              <Card label="Open requirements" value={openReqs.length} href="/crm/requirements?status=active" />
              <Card label="Quotations" value={quoteRows.length} href="/crm/quotations" />
              <Card label="Pending quotations" value={pendingQuotes.length} href="/crm/quotations?status=sent" />
              <Card label="Won quotations" value={wonQuotes.length} href="/crm/quotations?status=accepted" />
              <Card label="Orders" value={orderRows.length} href="/crm/orders" />
              <Card label="Active orders" value={inProgress.length} href="/crm/order-management" />
              <Card label="Completed orders" value={delivered.length} href="/crm/orders?status=delivered" />
              <Card label="Cancelled orders" value={cancelled.length} href="/crm/orders?status=cancelled" />
              <Card label="Revenue" value={formatCurrency(totalOrderValue)} />
              {canSeeFinance(profile.role) && <Card label="Outstanding" value={formatCurrency(outstanding)} href="/crm/receivables" />}
              {canSeeFinance(profile.role) && <Card label="Payables" value={formatCurrency(payableTotal)} href="/crm/payables" />}
              {canSeeFinance(profile.role) && <Card label="Gross margin" value={formatCurrency(margin)} />}
              <Card label="Clients" value={companies.count || 0} href="/crm/companies" />
              <Card label="Campaigns" value={campaigns.count || 0} href="/crm/campaigns" />
              <Card label="Delayed" value={delayed.length} href="/crm/order-management?health=delayed" warn={delayed.length > 0} />
              <Card label="Samples out" value={samplesOut} href="/crm/samples" />
              <Card label="Client samples" value={samplesClient} href="/crm/samples" />
              <Card label="Supplier samples" value={samplesSupplier} href="/crm/samples" />
            </div>
          </section>

          {profile.role === 'management' && (
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-serif text-lg mb-3">Exceptions</h2>
              <p className="text-sm">Delayed: {delayed.length} · At risk: {atRisk.length} · Unassigned: {unassigned.length} · Lost requirements: {lost}</p>
              <Link href="/crm/order-management?health=delayed" className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Open delayed orders</Link>
            </div>
          )}

          <div className="rounded-xl border bg-white p-4 sm:p-6">
            <div className="mb-4 flex justify-between">
              <h2 className="font-serif text-lg">Order pipeline</h2>
              <Link href="/crm/order-management?view=kanban" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]">Kanban</Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4 lg:grid-cols-6">
              {byStage.map((s) => (
                <Link key={s.st} href={`/crm/order-management?stage=${s.st}`} className="rounded-xl border bg-[#FAF7F2] p-2.5 hover:border-[#1A3022] sm:p-3">
                  <p className="text-[11px] text-[#7A7267]">{ORDER_STATUS_LABELS[s.st]}</p>
                  <p className="mt-1 text-lg font-semibold sm:text-xl">{s.n}</p>
                  <p className="text-[10px] text-[#7A7267] sm:text-[11px]">{formatCurrency(s.value)} · {s.overdue} overdue</p>
                </Link>
              ))}
              {canSeeFinance(profile.role) && financeStages.map((s) => (
                <Link key={s.key} href={s.href} className="rounded-xl border bg-[#FAF7F2] p-2.5 hover:border-[#1A3022] sm:p-3">
                  <p className="text-[11px] text-[#7A7267]">{s.label}</p>
                  <p className="mt-1 text-lg font-semibold sm:text-xl">{s.n}</p>
                  <p className="text-[10px] text-[#7A7267] sm:text-[11px]">{formatCurrency(s.value)}</p>
                </Link>
              ))}
            </div>
          </div>

          {profile.role === 'admin' && (
            <>
              <div className="bg-white rounded-xl border p-6">
                <h2 className="font-serif text-lg mb-3">Departments</h2>
                <div className="grid md:grid-cols-3 gap-3">
                  {deptStats.map((d) => (
                    <Link
                      key={d.id}
                      href={`/crm/order-management?department=${d.id}`}
                      className="rounded-xl border border-[#E8E4DE] bg-[#FAF7F2] p-3 transition-colors hover:border-[#1A3022] hover:bg-white"
                    >
                      <p className="text-sm font-semibold">{d.name}</p>
                      <p className="text-[11px] text-[#7A7267] mt-1">Active {d.active} · Overdue {d.overdue} · Unassigned {d.unassigned} · Done {d.completed}</p>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto rounded-xl border bg-white">
                <div className="p-4 sm:p-6">
                  <h2 className="mb-4 font-serif text-lg">Team performance</h2>
                  <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E8E4DE] text-[#7A7267]">
                        <th className="whitespace-nowrap py-3 pr-4 font-medium">Employee</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Role</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Leads</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Converted</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Requirements</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Quotations</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Orders</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Order value</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Pending tasks</th>
                        <th className="whitespace-nowrap px-3 py-3 font-medium">Overdue</th>
                        <th className="whitespace-nowrap py-3 pl-3 font-medium">Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {people.map((p) => (
                        <tr key={p.id} className="border-t border-[#EFE9E0]">
                          <td className="whitespace-nowrap py-3 pr-4 font-medium text-[#1C1917]">{p.full_name}</td>
                          <td className="whitespace-nowrap px-3 py-3 capitalize">{p.role}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.leads}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.converted}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.reqs}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.quotes}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.assigned}</td>
                          <td className="whitespace-nowrap px-3 py-3">{formatCurrency(p.orderValue)}</td>
                          <td className="whitespace-nowrap px-3 py-3">{p.pending}</td>
                          <td className={`whitespace-nowrap px-3 py-3 ${p.overdue ? 'font-semibold text-red-700' : ''}`}>
                            {p.overdue}
                          </td>
                          <td className="whitespace-nowrap py-3 pl-3">{p.completed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <ActivityFeed />
        </>
      )}

      {profile.role === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="My leads" value={leadRows.length} href="/crm/leads" />
            <Card label="My requirements" value={openReqs.length} href="/crm/requirements" />
            <Card label="My quotations" value={quoteRows.length} href="/crm/quotations?owner=mine" />
            <Card label="Pending quotes" value={pendingQuotes.length} href="/crm/quotations?status=sent" />
            <Card label="My orders" value={orderRows.length} href="/crm/orders" />
            <Card label="My revenue" value={formatCurrency(totalOrderValue)} />
            <Card label="Req → quote" value={`${reqToQuote}%`} />
            <Card label="Quote → order" value={`${quoteToOrder}%`} />
            <Card label="My work" value="Open" href="/crm/my-work" />
            <Card label="Follow-ups" value={(followUps.data || []).length} href="/crm/activities" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border p-5">
              <h2 className="font-serif text-lg mb-2">Upcoming follow-ups</h2>
              {(followUps.data || []).map((a) => (
                <p key={a.id} className="text-sm py-1">{a.type} · {a.title}</p>
              ))}
              {(!followUps.data || followUps.data.length === 0) && <p className="text-sm text-gray-500">No follow-ups due.</p>}
              <Link href="/crm/activities" className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]">Activity feed</Link>
            </div>
            <ActivityFeed />
          </div>
        </div>
      )}

      {profile.role === 'operations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Assigned to me" value={inProgress.filter((o) => o.assigned_to === profile.id).length} href="/crm/my-work" />
            <Card label="Department work" value={inProgress.filter((o) => o.current_department_id === profile.department_id).length} href="/crm/department" />
            <Card label="Delayed" value={delayed.length} href="/crm/order-management?health=delayed" warn={delayed.length > 0} />
            <Card label="Procurement" value={orderRows.filter((o) => o.status === 'procurement').length} href="/crm/order-management?stage=procurement" />
            <Card label="Printing" value={orderRows.filter((o) => o.status === 'printing').length} href="/crm/order-management?stage=printing" />
            <Card label="QC" value={orderRows.filter((o) => o.status === 'quality_check').length} href="/crm/order-management?stage=quality_check" />
            <Card label="Packing" value={orderRows.filter((o) => o.status === 'ready_to_dispatch').length} href="/crm/order-management?stage=ready_to_dispatch" />
            <Card label="In transit" value={orderRows.filter((o) => o.status === 'dispatched').length} href="/crm/order-management?stage=dispatched" />
            <Card label="Delivered" value={delivered.length} href="/crm/orders?status=delivered" />
            <Card label="Kanban" value="Board" href="/crm/order-management?view=kanban" />
          </div>
          <ActivityFeed />
        </div>
      )}

      {profile.role === 'accounts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card label="Ready to invoice" value={readyToInvoice} href="/crm/orders" />
            <Card label="Invoices" value={invoiceRows.length} href="/crm/invoices" />
            <Card label="Unpaid" value={unpaid.length} href="/crm/receivables" />
            <Card label="Partial" value={partial.length} href="/crm/receivables" />
            <Card label="Overdue" value={overdueInv.length} href="/crm/receivables" warn={overdueInv.length > 0} />
            <Card label="Received" value={formatCurrency(paid)} href="/crm/payments" />
            <Card label="Outstanding" value={formatCurrency(outstanding)} href="/crm/receivables" />
            <Card label="Payables" value={formatCurrency(payableTotal)} href="/crm/payables" />
            <Card label="GST reports" value="Open" href="/crm/gst-reports" />
          </div>
          <ActivityFeed />
        </div>
      )}
    </div>
  )
}
