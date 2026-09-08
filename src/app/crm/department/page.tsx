import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ORDER_STATUS_LABELS, orderHealth, HEALTH_LABELS, HEALTH_STYLES } from '@/lib/order-workflow'
import Link from 'next/link'

export default async function DepartmentPage() {
  const profile = await requireStaff(['admin', 'operations', 'management', 'accounts', 'sales'])
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: department } = profile.department_id
    ? await supabase.from('departments').select('id, name, slug, manager_id, manager:manager_id(full_name)').eq('id', profile.department_id).maybeSingle()
    : { data: null }

  const deptId = department?.id
  if (!deptId && profile.role !== 'admin') {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Department</h1>
        <p className="text-sm text-gray-500 mt-2">Your profile is not assigned to a department yet.</p>
      </div>
    )
  }

  const deptFilter = deptId || undefined

  const [{ data: members }, { data: orders }, { data: tasks }] = await Promise.all([
    deptFilter
      ? supabase.from('department_members').select('user_id, profiles(full_name, email, role)').eq('department_id', deptFilter)
      : supabase.from('profiles').select('id, full_name, email, role').in('role', ['admin', 'sales', 'operations', 'accounts', 'management']),
    deptFilter
      ? supabase.from('orders').select('id, order_number, status, order_value, expected_delivery_date, stage_due_at, assigned_to, company:companies(name)').eq('current_department_id', deptFilter)
      : supabase.from('orders').select('id, order_number, status, order_value, expected_delivery_date, stage_due_at, assigned_to, company:companies(name)'),
    deptFilter
      ? supabase.from('tasks').select('id, title, status, due_at, assigned_to, completed_at').eq('department_id', deptFilter)
      : supabase.from('tasks').select('id, title, status, due_at, assigned_to, completed_at').limit(50),
  ])

  const orderRows = orders || []
  const taskRows = tasks || []
  const active = orderRows.filter((o) => !['delivered', 'cancelled'].includes(o.status))
  const dueToday = active.filter((o) => o.expected_delivery_date === today || o.stage_due_at === today)
  const overdue = active.filter((o) => orderHealth(o.status, o.expected_delivery_date, o.stage_due_at) === 'delayed')
  const completed = orderRows.filter((o) => o.status === 'delivered')
  const pendingTasks = taskRows.filter((t) => t.status !== 'done' && !t.completed_at)
  const overdueTasks = pendingTasks.filter((t) => t.due_at && t.due_at < today)
  const manager = department ? (Array.isArray(department.manager) ? department.manager[0] : department.manager) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-primary)]">{department?.name || 'All departments'} dashboard</h1>
        <p className="text-xs text-[#7A7267] mt-1">
          Manager: {manager?.full_name || '—'} · Workload for authorized department members.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-[#7A7267]">Active orders</p><p className="text-2xl font-semibold mt-1">{active.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-[#7A7267]">Due today</p><p className="text-2xl font-semibold mt-1">{dueToday.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-[#7A7267]">Overdue</p><p className="text-2xl font-semibold mt-1 text-red-700">{overdue.length}</p></div>
        <div className="bg-white p-4 rounded-2xl border"><p className="text-xs text-[#7A7267]">Completed</p><p className="text-2xl font-semibold mt-1">{completed.length}</p></div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-serif text-lg mb-3">Department orders</h2>
          <div className="space-y-2">
            {active.slice(0, 12).map((o) => {
              const company = Array.isArray(o.company) ? o.company[0] : o.company
              const health = orderHealth(o.status, o.expected_delivery_date, o.stage_due_at)
              return (
                <Link key={o.id} href={`/crm/orders/${o.id}`} className="flex justify-between items-center p-2 rounded-lg hover:bg-[#FAF7F2]">
                  <div>
                    <p className="text-sm font-mono font-semibold">{o.order_number}</p>
                    <p className="text-[11px] text-[#7A7267]">{company?.name} · {ORDER_STATUS_LABELS[o.status] || o.status} · {formatCurrency(o.order_value)}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${HEALTH_STYLES[health]}`}>{HEALTH_LABELS[health]}</span>
                </Link>
              )
            })}
            {active.length === 0 && <p className="text-sm text-gray-500">No active department orders.</p>}
          </div>
        </div>
        <div className="bg-white rounded-2xl border p-5 space-y-4">
          <div>
            <h2 className="font-serif text-lg mb-3">People</h2>
            <ul className="text-sm space-y-1">
              {(members || []).map((m: any, i: number) => {
                const p = m.profiles || m
                const person = Array.isArray(p) ? p[0] : p
                return <li key={m.user_id || m.id || i}>{person?.full_name} · {person?.role}</li>
              })}
            </ul>
          </div>
          <div>
            <h2 className="font-serif text-lg mb-2">Pending / overdue tasks</h2>
            {pendingTasks.slice(0, 8).map((t) => (
              <p key={t.id} className="text-sm py-1">{t.title} · {formatDate(t.due_at)} {t.due_at && t.due_at < today ? <span className="text-red-700">(overdue)</span> : null}</p>
            ))}
            {overdueTasks.length === 0 && pendingTasks.length === 0 && <p className="text-sm text-gray-500">No pending tasks.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
