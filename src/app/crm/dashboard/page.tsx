import { createClient } from '@/lib/supabase/server'
import { requireStaff, canSeeFinance, applyOrderScope, applyOwnerScope, applyCompanyScope, seesAllSalesRecords } from '@/lib/auth'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS, orderHealth } from '@/lib/order-workflow'
import { ORDER_SOURCE_LABELS, ORDER_SOURCES } from '@/lib/orders/source'
import { entityHref, describeAudit } from '@/lib/entity-href'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { MobileDateRangeFilter } from '@/components/ui/mobile-filter-sheet'

function Card({
  label,
  value,
  href,
  warn,
  detail,
}: {
  label: string
  value: string | number
  href?: string
  warn?: boolean
  detail?: string
}) {
  const isMono = typeof value === 'number' || /^[₹\d%]/.test(String(value))
  const inner = (
    <div
      className={`h-full bg-[#FCF9F2] border border-[#CCC5BD] p-3.5 sm:p-4 rounded-none flex flex-col justify-between gap-2 transition-colors group-hover:bg-[#F6F3EC] ${
        warn ? 'border-l-[3px] border-l-[#9E4300]' : ''
      }`}
    >
      <span
        className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
          warn ? 'text-[#9E4300]' : 'text-[#7C766F]'
        }`}
      >
        {label}
      </span>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <p
          className={`${
            isMono
              ? 'font-mono text-2xl sm:text-[28px] font-semibold tracking-tight'
              : 'text-lg sm:text-xl font-medium'
          } text-[#1C1B1A] break-words`}
        >
          {value}
        </p>
        {detail ? (
          <span className="font-mono text-[11px] text-[#7C766F] truncate max-w-full">
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  )
  return href ? (
    <Link href={href} className="group block h-full">
      {inner}
    </Link>
  ) : (
    inner
  )
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
  source?: string | null
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
      .select('id, status, source, order_value, expected_delivery_date, assigned_to, current_department_id, stage_due_at, owner_id, company_id, gross_profit, created_at'),
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
  const newOrders = orderRows.filter((order) => order.created_at && order.created_at >= weekAgo)
  const newOrderDetail = ORDER_SOURCES
    .map((source) => {
      const count = newOrders.filter((order) => order.source === source).length
      return count ? `${ORDER_SOURCE_LABELS[source]} ${count}` : ''
    })
    .filter(Boolean)
    .join(' · ')
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
    <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none flex flex-col">
      <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
        <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
          Activity
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
            {activityRows.length} RECENT
          </span>
          {(profile.role === 'admin' || profile.role === 'management') && (
            <Link
              href="/crm/audit-log"
              className="inline-flex items-center justify-center rounded-none border border-[#1C1B1A] bg-transparent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] transition-colors hover:bg-[#F6F3EC]"
            >
              Full audit log
            </Link>
          )}
        </div>
      </div>
      <div className="divide-y divide-[#CCC5BD] max-h-96 overflow-y-auto">
        {activityRows.map((row) => {
          const actor = Array.isArray(row.profile) ? row.profile[0] : row.profile
          const href = entityHref(row.entity, row.entity_id)
          const inner = (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm text-[#1C1B1A]">
                <span className="font-semibold">{actor?.full_name || 'System'}</span>{' '}
                <span className="text-[#4A4640]">{describeAudit(row.action, row.entity || 'record')}</span>
                {row.entity_id ? (
                  <span className="font-mono text-[11px] text-[#7C766F]">
                    {' '}#{String(row.entity_id).slice(0, 8)}
                  </span>
                ) : null}
              </p>
              <p className="font-mono text-[11px] text-[#7C766F]">{formatDateTime(row.created_at)}</p>
            </div>
          )
          return href ? (
            <Link
              key={row.id}
              href={href}
              className="block px-5 py-3 transition-colors hover:bg-[#F6F3EC]"
            >
              {inner}
            </Link>
          ) : (
            <div key={row.id} className="px-5 py-3">
              {inner}
            </div>
          )
        })}
        {activityRows.length === 0 && (
          <div className="p-5 text-sm text-[#7C766F]">No recent activity.</div>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="space-y-6 sm:space-y-8 text-[#1C1B1A]"
    >
      {/* Page Title Row */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            Good day, {greeting}
          </h1>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
            {roleTitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(profile.role === 'admin' || profile.role === 'sales') && (
            <Link
              href="/crm/products/add"
              className="inline-flex items-center justify-center gap-1.5 rounded-none bg-[#1C1B1A] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300]"
            >
              <Plus size={14} />
              Add Product
            </Link>
          )}
          {(profile.role === 'admin' || profile.role === 'management') && (
            <MobileDateRangeFilter
              from={from || ''}
              to={to || ''}
              submitLabel="Filter"
              className="w-full sm:w-auto"
            />
          )}
        </div>
      </div>

      {(profile.role === 'admin' || profile.role === 'management') && (
        <>
          <section>
            <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-3">
              Business overview
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
              <Card label="New orders" value={newOrders.length} href="/crm/orders" detail={newOrderDetail || 'Last 7 days'} />
              <Card label="Active orders" value={inProgress.length} href="/crm/order-management" />
              <Card label="Completed orders" value={delivered.length} href="/crm/orders?status=delivered" />
              <Card label="Cancelled orders" value={cancelled.length} href="/crm/orders?status=cancelled" />
              <Card label="Revenue" value={formatCurrency(totalOrderValue)} />
              {canSeeFinance(profile.role) && <Card label="Outstanding" value={formatCurrency(outstanding)} href="/crm/receivables" />}
              {canSeeFinance(profile.role) && <Card label="Payables" value={formatCurrency(payableTotal)} href="/crm/payables" />}
              {canSeeFinance(profile.role) && <Card label="Gross margin" value={formatCurrency(margin)} />}
              <Card label="Clients" value={companies.count || 0} href="/crm/companies" />
              <Card label="Catalogs" value={campaigns.count || 0} href="/crm/catalogs" />
              <Card label="Delayed" value={delayed.length} href="/crm/order-management?health=delayed" warn={delayed.length > 0} />
              <Card label="Samples out" value={samplesOut} href="/crm/samples" />
              <Card label="Client samples" value={samplesClient} href="/crm/samples" />
              <Card label="Supplier samples" value={samplesSupplier} href="/crm/samples" />
            </div>
          </section>

          {profile.role === 'management' && (
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
              <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
                <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
                  Exceptions
                </h2>
                <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
                  {delayed.length} DELAYED
                </span>
              </div>
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-[#4A4640]">
                  Delayed: <span className="font-mono font-semibold text-[#1C1B1A]">{delayed.length}</span> · At risk: <span className="font-mono font-semibold text-[#1C1B1A]">{atRisk.length}</span> · Unassigned: <span className="font-mono font-semibold text-[#1C1B1A]">{unassigned.length}</span> · Lost requirements: <span className="font-mono font-semibold text-[#1C1B1A]">{lost}</span>
                </p>
                <Link
                  href="/crm/order-management?health=delayed"
                  className="inline-flex items-center justify-center rounded-none bg-[#1C1B1A] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] transition-colors hover:bg-[#9E4300] shrink-0"
                >
                  Open delayed orders
                </Link>
              </div>
            </div>
          )}

          <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
            <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
              <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
                Order pipeline
              </h2>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
                  {orderRows.length} ORDERS
                </span>
                <Link
                  href="/crm/order-management?view=kanban"
                  className="inline-flex items-center justify-center rounded-none border border-[#1C1B1A] bg-transparent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] transition-colors hover:bg-[#F6F3EC]"
                >
                  Kanban
                </Link>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {byStage.map((s) => (
                  <Link
                    key={s.st}
                    href={`/crm/order-management?stage=${s.st}`}
                    className="group block bg-[#F6F3EC] border border-[#CCC5BD] p-3 rounded-none transition-colors hover:border-[#1C1B1A] hover:bg-white"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] truncate">
                      {ORDER_STATUS_LABELS[s.st]}
                    </p>
                    <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-[#1C1B1A]">
                      {s.n}
                    </p>
                    <p className="mt-1 text-[11px] font-mono text-[#7C766F] truncate">
                      {formatCurrency(s.value)} · <span className={s.overdue > 0 ? 'text-[#9E4300] font-bold' : ''}>{s.overdue} overdue</span>
                    </p>
                  </Link>
                ))}
                {canSeeFinance(profile.role) && financeStages.map((s) => (
                  <Link
                    key={s.key}
                    href={s.href}
                    className="group block bg-[#F6F3EC] border border-[#CCC5BD] p-3 rounded-none transition-colors hover:border-[#1C1B1A] hover:bg-white"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] truncate">
                      {s.label}
                    </p>
                    <p className="mt-1 font-mono text-xl sm:text-2xl font-semibold text-[#1C1B1A]">
                      {s.n}
                    </p>
                    <p className="mt-1 text-[11px] font-mono text-[#7C766F] truncate">
                      {formatCurrency(s.value)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {profile.role === 'admin' && (
            <>
              <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
                <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
                  <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
                    Departments
                  </h2>
                  <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
                    {deptStats.length} DEPARTMENTS
                  </span>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="grid md:grid-cols-3 gap-3">
                    {deptStats.map((d) => (
                      <Link
                        key={d.id}
                        href={`/crm/order-management?department=${d.id}`}
                        className="group block bg-[#F6F3EC] border border-[#CCC5BD] p-3.5 rounded-none transition-colors hover:border-[#1C1B1A] hover:bg-white"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-[#1C1B1A]">{d.name}</p>
                          {d.overdue > 0 && (
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
                              {d.overdue} OVERDUE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-mono text-[#7C766F] mt-2 leading-relaxed">
                          Active <span className="font-semibold text-[#1C1B1A]">{d.active}</span> · Overdue <span className={`font-semibold ${d.overdue ? 'text-[#9E4300]' : 'text-[#1C1B1A]'}`}>{d.overdue}</span> · Unassigned <span className="font-semibold text-[#1C1B1A]">{d.unassigned}</span> · Done <span className="font-semibold text-[#1C1B1A]">{d.completed}</span>
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
                <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
                  <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
                    Team performance
                  </h2>
                  <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
                    {people.length} MEMBERS
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                        <th className="whitespace-nowrap py-3 px-4 font-bold">Employee</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold">Role</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Leads</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Converted</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Requirements</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Quotations</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Orders</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Order value</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Pending tasks</th>
                        <th className="whitespace-nowrap px-3 py-3 font-bold text-right">Overdue</th>
                        <th className="whitespace-nowrap py-3 px-4 font-bold text-right">Completed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#CCC5BD] text-[#1C1B1A]">
                      {people.map((p) => (
                        <tr key={p.id} className="hover:bg-[#F6F3EC] transition-colors">
                          <td className="whitespace-nowrap py-3 px-4 font-medium text-[#1C1B1A]">{p.full_name}</td>
                          <td className="whitespace-nowrap px-3 py-3 capitalize text-[#4A4640]">{p.role}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.leads}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.converted}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.reqs}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.quotes}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.assigned}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono font-medium">{formatCurrency(p.orderValue)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right font-mono">{p.pending}</td>
                          <td className={`whitespace-nowrap px-3 py-3 text-right font-mono ${p.overdue ? 'font-semibold text-[#9E4300]' : ''}`}>
                            {p.overdue}
                          </td>
                          <td className="whitespace-nowrap py-3 px-4 text-right font-mono">{p.completed}</td>
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
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none flex flex-col">
              <div className="px-5 py-3.5 border-b border-[#CCC5BD] flex items-center justify-between bg-[#F6F3EC]">
                <h2 className="font-[family-name:var(--font-newsreader)] text-lg sm:text-xl font-normal text-[#1C1B1A]">
                  Upcoming follow-ups
                </h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] font-bold text-[#9E4300] tracking-wider uppercase">
                    {(followUps.data || []).length} DUE
                  </span>
                  <Link
                    href="/crm/activities"
                    className="inline-flex items-center justify-center rounded-none border border-[#1C1B1A] bg-transparent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] transition-colors hover:bg-[#F6F3EC]"
                  >
                    Activity feed
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-[#CCC5BD] max-h-96 overflow-y-auto">
                {(followUps.data || []).map((a) => (
                  <div key={a.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#F6F3EC] transition-colors">
                    <span className="text-sm text-[#1C1B1A] font-medium">{a.title}</span>
                    <span className="font-mono text-[11px] font-medium uppercase px-2 py-0.5 border border-[#CCC5BD] text-[#4A4640] rounded-none bg-transparent shrink-0">
                      {a.type}
                    </span>
                  </div>
                ))}
                {(!followUps.data || followUps.data.length === 0) && (
                  <div className="p-5 text-sm text-[#7C766F]">No follow-ups due.</div>
                )}
              </div>
            </div>
            <ActivityFeed />
          </div>
        </div>
      )}

      {profile.role === 'operations' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <Card label="Assigned to me" value={inProgress.filter((o) => o.assigned_to === profile.id).length} href="/crm/my-work" />
            <Card label="Department work" value={inProgress.filter((o) => o.current_department_id === profile.department_id).length} href="/crm/department" />
            <Card label="Delayed" value={delayed.length} href="/crm/order-management?health=delayed" warn={delayed.length > 0} />
            <Card label="Procurement" value={orderRows.filter((o) => o.status === 'procurement').length} href="/crm/order-management?stage=procurement" />
            <Card label="Mockup" value={orderRows.filter((o) => o.status === 'mockup').length} href="/crm/order-management?stage=mockup" />
            <Card label="Client approval" value={orderRows.filter((o) => o.status === 'client_approval').length} href="/crm/order-management?stage=client_approval" />
            <Card label="Production" value={orderRows.filter((o) => o.status === 'production').length} href="/crm/order-management?stage=production" />
            <Card label="Packaging / QC" value={orderRows.filter((o) => o.status === 'packaging_qc').length} href="/crm/order-management?stage=packaging_qc" />
            <Card label="Dispatch" value={orderRows.filter((o) => o.status === 'dispatched').length} href="/crm/order-management?stage=dispatched" />
            <Card label="Delivered" value={delivered.length} href="/crm/orders?status=delivered" />
            <Card label="Kanban" value="Board" href="/crm/order-management?view=kanban" />
          </div>
          <ActivityFeed />
        </div>
      )}

      {profile.role === 'accounts' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
