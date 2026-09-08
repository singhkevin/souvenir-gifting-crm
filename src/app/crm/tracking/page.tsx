import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import { ORDER_STATUS_LABELS, orderHealth, HEALTH_LABELS, HEALTH_STYLES } from '@/lib/order-workflow'
import Link from 'next/link'
import { completeTask, reassignTask, updateTaskStatus } from '@/app/crm/tasks/actions'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

const TASK_STATUS_OPTIONS = [
  { value: 'open', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default async function AdminTrackingPage() {
  const profile = await requireStaff(['admin', 'management'])
  const canMutateTasks = profile.role === 'admin' || profile.role === 'operations'
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [
    { count: companyCount },
    { count: clientCount },
    { count: productCount },
    { count: quotationCount },
    { data: orders },
    { data: tasks },
    { data: staff },
    { data: assignments },
  ] = await Promise.all([
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).in('role', ['client_admin', 'client_user']),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('quotations').select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id, order_number, status, order_value, expected_delivery_date, stage_due_at, assigned_to, company:companies(name), assignee:assigned_to(full_name)')
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('tasks')
      .select('id, title, status, due_at, assigned_to, company:companies(name), order:orders(order_number), assignee:profiles!assigned_to(full_name)')
      .order('due_at', { ascending: true })
      .limit(50),
    supabase.from('profiles').select('id, full_name, role').not('role', 'in', '(client_admin,client_user)').eq('is_active', true).order('full_name'),
    supabase
      .from('order_assignments')
      .select('id, created_at, note, order:orders(id, order_number, status), assignee:assigned_to(full_name), department:department_id(name)')
      .order('created_at', { ascending: false })
      .limit(40),
  ])

  const openTasks = (tasks || []).filter((task) => task.status !== 'done' && task.status !== 'cancelled')
  const overdueTasks = openTasks.filter((task) => task.due_at && task.due_at < today)
  const pendingOrders = (orders || []).filter((order) => order.status !== 'delivered' && order.status !== 'cancelled')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operational tracking</h1>
        <p className="text-xs text-gray-500 mt-1">
          Full admin visibility across companies, catalogue, quotations, orders and assigned work.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Stat href="/crm/companies" label="Companies" value={companyCount || 0} />
        <Stat href="/crm/companies" label="Clients" value={clientCount || 0} />
        <Stat href="/crm/products" label="Products" value={productCount || 0} />
        <Stat href="/crm/quotations" label="Quotations" value={quotationCount || 0} />
        <Stat href="/crm/orders" label="Open orders" value={pendingOrders.length} />
        <Stat href="/crm/tasks" label="Overdue tasks" value={overdueTasks.length} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-bold text-sm">Orders</h2>
          <Link href="/crm/order-management" className="text-xs text-[#4A235A] font-semibold">Order management</Link>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Order</th>
              <th className="text-left px-4 py-2">Company</th>
              <th className="text-left px-4 py-2">Assignee</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Health</th>
              <th className="text-left px-4 py-2">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(orders || []).map((order) => {
              const company = oneRelation(order.company)
              const assignee = oneRelation(order.assignee)
              const health = orderHealth(order.status, order.expected_delivery_date, order.stage_due_at)
              return (
                <tr key={order.id}>
                  <td className="px-4 py-2 font-semibold">
                    <Link href={`/crm/orders/${order.id}`} className="text-[#4A235A]">{order.order_number}</Link>
                  </td>
                  <td className="px-4 py-2">{company?.name || '—'}</td>
                  <td className="px-4 py-2">{assignee?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-2">{ORDER_STATUS_LABELS[order.status] || order.status}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${HEALTH_STYLES[health]}`}>
                      {HEALTH_LABELS[health]}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium">{formatCurrency(order.order_value)}</td>
                </tr>
              )
            })}
            {(!orders || orders.length === 0) && (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">No orders yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-bold text-sm">Tasks</h2>
          <Link href="/crm/tasks?tab=all_tasks" className="text-xs text-[#4A235A] font-semibold">All tasks</Link>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Task</th>
              <th className="text-left px-4 py-2">Company / Order</th>
              <th className="text-left px-4 py-2">Assignee</th>
              <th className="text-left px-4 py-2">Due</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(tasks || []).map((task) => {
              const assignee = oneRelation(task.assignee)
              const company = oneRelation(task.company)
              const order = oneRelation(task.order)
              const overdue = task.due_at && task.due_at < today && task.status !== 'done'
              return (
                <tr key={task.id}>
                  <td className="px-4 py-2 font-medium">{task.title}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {company?.name || '—'}
                    {order?.order_number ? ` · ${order.order_number}` : ''}
                  </td>
                  <td className="px-4 py-2">
                    {canMutateTasks ? (
                    <form action={asFormAction(reassignTask)} className="flex min-w-[140px] flex-col gap-1">
                      <input type="hidden" name="id" value={task.id} />
                      <MobileSheetSelect
                        name="assigned_to"
                        label="Assigned to"
                        defaultValue={task.assigned_to || ''}
                        options={(staff || []).map((member) => ({
                          value: member.id,
                          label: member.full_name || 'Unnamed',
                        }))}
                      />
                      <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Save</button>
                    </form>
                    ) : (
                      assignee?.full_name || 'Unassigned'
                    )}
                  </td>
                  <td className={`px-4 py-2 ${overdue ? 'text-red-600 font-semibold' : ''}`}>{formatDate(task.due_at)}</td>
                  <td className="px-4 py-2">
                    {canMutateTasks ? (
                    <>
                    <form action={asFormAction(updateTaskStatus)} className="flex min-w-[140px] flex-col gap-1">
                      <input type="hidden" name="id" value={task.id} />
                      <MobileSheetSelect
                        name="status"
                        label="Status"
                        defaultValue={task.status || 'open'}
                        options={TASK_STATUS_OPTIONS}
                      />
                      <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Update</button>
                    </form>
                    {task.status !== 'done' && (
                      <form action={asFormAction(completeTask)}>
                        <input type="hidden" name="id" value={task.id} />
                        <button className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]">Complete</button>
                      </form>
                    )}
                    </>
                    ) : (
                      <span className="capitalize">{String(task.status || 'open').replace('_', ' ')}</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {(!tasks || tasks.length === 0) && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">No tasks yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-bold text-sm">Stage assignments</h2>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Order</th>
              <th className="text-left px-4 py-2">Department</th>
              <th className="text-left px-4 py-2">Assigned to</th>
              <th className="text-left px-4 py-2">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(assignments || []).map((row) => {
              const order = oneRelation(row.order)
              const assignee = oneRelation(row.assignee)
              const department = oneRelation(row.department)
              return (
                <tr key={row.id}>
                  <td className="px-4 py-2 font-semibold">
                    {order?.id ? (
                      <Link href={`/crm/orders/${order.id}`} className="text-[#4A235A]">{order.order_number}</Link>
                    ) : '—'}
                    {order?.status ? <span className="ml-2 text-gray-400">{ORDER_STATUS_LABELS[order.status] || order.status}</span> : null}
                  </td>
                  <td className="px-4 py-2">{department?.name || '—'}</td>
                  <td className="px-4 py-2">{assignee?.full_name || 'Unassigned'}</td>
                  <td className="px-4 py-2">{formatDate(row.created_at)}</td>
                </tr>
              )
            })}
            {(!assignments || assignments.length === 0) && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">No stage assignments recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-bold text-sm mb-3">Employees</h2>
        <div className="flex flex-wrap gap-2">
          {(staff || []).map((member) => (
            <span key={member.id} className="px-2.5 py-1 rounded-full bg-gray-50 border text-xs">
              {member.full_name} <span className="text-gray-400 capitalize">{member.role}</span>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">Signed in as {profile.full_name}. Admin permissions are unchanged.</p>
      </div>
    </div>
  )
}

function Stat({ href, label, value }: { href: string; label: string; value: number }) {
  return (
    <Link href={href} className="bg-white border border-gray-200 rounded-xl px-3 py-3 hover:border-[#4A235A]">
      <p className="text-[10px] uppercase font-semibold text-gray-400">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </Link>
  )
}
