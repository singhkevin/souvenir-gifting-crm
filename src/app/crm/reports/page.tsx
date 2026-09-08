import { createClient } from '@/lib/supabase/server'
import { formatCurrency, ORDER_STATUSES, ORDER_STATUS_LABELS } from '@/lib/utils'
import { requireStaff, canSeeFinance } from '@/lib/auth'
import Link from 'next/link'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const profile = await requireStaff(['admin', 'management', 'accounts'])
  const supabase = await createClient()

  const requested = (await searchParams).tab || (profile.role === 'accounts' ? 'finance' : 'sales')
  const tab = requested

  const [
    { data: orders },
    { data: invoices },
    { data: leads },
    { data: samples },
  ] = await Promise.all([
    supabase.from('orders').select('order_value, status, created_at'),
    supabase.from('invoices').select('amount, status'),
    supabase.from('leads').select('stage'),
    supabase.from('sample_stock').select('in_office, with_client, pending_supplier, with_team, unit_cost, products(name, sku)'),
  ])

  const bookedStatuses = new Set([
    'created',
    'confirmed',
    'in_progress',
    'procurement',
    'printing',
    'quality_check',
    'ready_to_dispatch',
    'dispatched',
    'delivered',
  ])

  const totalRevenue =
    orders
      ?.filter((o) => bookedStatuses.has(o.status))
      .reduce((sum, o) => sum + Number(o.order_value), 0) || 0
  const activeOrdersCount =
    orders?.filter((o) => o.status !== 'delivered').length || 0
  const totalInvoiced = invoices?.reduce((sum, i) => sum + Number(i.amount), 0) || 0
  const collected =
    invoices?.filter((i) => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0) || 0

  const leadsByStage =
    leads?.reduce((acc: Record<string, number>, lead) => {
      acc[lead.stage] = (acc[lead.stage] || 0) + 1
      return acc
    }, {}) || {}

  const ordersByStatus =
    orders?.reduce((acc: Record<string, number>, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1
      return acc
    }, {}) || {}

  const monthBuckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
    const value =
      orders
        ?.filter((o) => o.created_at?.startsWith(key))
        .reduce((sum, o) => sum + Number(o.order_value || 0), 0) || 0
    return { key, label, value }
  })
  const maxMonth = Math.max(...monthBuckets.map((m) => m.value), 1)

  const totalInOffice = samples?.reduce((acc, s) => acc + (s.in_office || 0), 0) || 0
  const totalWithClient = samples?.reduce((acc, s) => acc + (s.with_client || 0), 0) || 0
  const totalPending = samples?.reduce((acc, s) => acc + (s.pending_supplier || 0), 0) || 0
  const sampleValue =
    samples?.reduce((acc, s) => {
      const qty = (s.in_office || 0) + (s.with_client || 0) + (s.with_team || 0)
      return acc + qty * Number(s.unit_cost || 0)
    }, 0) || 0

  const tabs =
    profile.role === 'accounts'
      ? ['finance', 'gst']
      : canSeeFinance(profile.role)
        ? ['sales', 'orders', 'finance', 'gst', 'samples']
        : ['sales', 'orders', 'samples']

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Reports & Analytics</h1>

      <div className="mb-6 md:hidden">
        <MobileFilterBar
          pathname="/crm/reports"
          fields={[
            {
              key: 'tab',
              label: 'Report',
              value: tab === tabs[0] ? '' : tab,
              emptyLabel: tabs[0] === 'gst' ? 'Tax Overview' : tabs[0].charAt(0).toUpperCase() + tabs[0].slice(1),
              options: tabs.map((t) => ({
                value: t === tabs[0] ? '' : t,
                label: t === 'gst' ? 'Tax Overview' : t.charAt(0).toUpperCase() + t.slice(1),
              })),
            },
          ]}
        />
      </div>
      <div className="mb-6 hidden gap-4 overflow-x-auto border-b border-[var(--color-border)] md:flex">
        {tabs.map((t) => (
          <Link
            key={t}
            href={`?tab=${t}`}
            className={`shrink-0 px-2 pb-2 font-medium ${
              tab === t
                ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-black'
            }`}
          >
            {t === 'gst' ? 'Tax Overview' : t.charAt(0).toUpperCase() + t.slice(1)}
          </Link>
        ))}
      </div>

      {tab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Booked Revenue</p>
              <p className="text-2xl font-bold text-green-700">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Leads</p>
              <p className="text-2xl font-bold">{leads?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Conversion Rate (Est)</p>
              <p className="text-2xl font-bold text-blue-600">
                {leads?.length
                  ? Math.round(
                      (((leadsByStage['client'] || 0) + (leadsByStage['regular_client'] || 0)) /
                        leads.length) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-4">Leads by Stage</h3>
            <div className="w-full max-w-md">
              {Object.entries(leadsByStage).map(([stage, count]) => (
                <div key={stage} className="flex items-center mb-2">
                  <div className="w-32 text-sm capitalize text-gray-600">{stage.replace('_', ' ')}</div>
                  <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                    <div
                      className="bg-[var(--color-primary)] h-full"
                      style={{ width: `${(Number(count) / (leads?.length || 1)) * 100}%` }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-medium">{String(count)}</div>
                </div>
              ))}
              {Object.keys(leadsByStage).length === 0 && (
                <p className="text-sm text-gray-500">No lead data yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'orders' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Orders</p>
              <p className="text-2xl font-bold">{orders?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Active Pipeline</p>
              <p className="text-2xl font-bold text-amber-600">{activeOrdersCount}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Delivered</p>
              <p className="text-2xl font-bold text-green-700">
                {orders?.filter((o) => o.status === 'delivered').length || 0}
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-4">Order value by month</h3>
            <div className="flex items-end gap-3 h-40">
              {monthBuckets.map((m) => (
                <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full bg-[var(--color-primary)] rounded-t"
                    style={{ height: `${Math.max((m.value / maxMonth) * 100, m.value ? 4 : 0)}%` }}
                    title={formatCurrency(m.value)}
                  />
                  <p className="text-[10px] text-gray-500 mt-2">{m.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-bold mb-4">Orders by status</h3>
            <div className="w-full max-w-lg">
              {ORDER_STATUSES.map((status) => {
                const count = ordersByStatus[status] || 0
                return (
                  <div key={status} className="flex items-center mb-2">
                    <div className="w-48 text-sm text-gray-600">{ORDER_STATUS_LABELS[status]}</div>
                    <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                      <div
                        className="bg-[var(--color-primary)] h-full"
                        style={{ width: `${(count / (orders?.length || 1)) * 100}%` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-medium">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Invoiced</p>
              <p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Collected</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(collected)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalInvoiced - collected)}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'samples' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">In Office</p>
              <p className="text-2xl font-bold">{totalInOffice}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">With Client</p>
              <p className="text-2xl font-bold text-blue-600">{totalWithClient}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Pending Supplier</p>
              <p className="text-2xl font-bold text-amber-600">{totalPending}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Stock Value</p>
              <p className="text-2xl font-bold">{formatCurrency(sampleValue)}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Full SKU-level sample stock lives on the Sample Stock page.</p>
            <Link
              href="/crm/samples"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]"
            >
              Open sample stock
            </Link>
          </div>
        </div>
      )}
      {tab === 'gst' && canSeeFinance(profile.role) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Total Invoiced</p>
              <p className="text-2xl font-bold">{formatCurrency(totalInvoiced)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Collected</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(collected)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-500 mb-1">Invoices</p>
              <p className="text-2xl font-bold">{invoices?.length || 0}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Invoice, GSTIN, taxable value and stored GST live on the dedicated GST Reports page. This tab is a finance
              overview only.
            </p>
            <Link
              href="/crm/gst-reports"
              className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white"
            >
              Open GST reports
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
