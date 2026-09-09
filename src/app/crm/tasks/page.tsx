import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { completeTask, createTask, reassignTask, updateTaskStatus } from './actions'
import { asFormAction } from '@/lib/form-action'
import Link from 'next/link'
import { MobileFilterBar, MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

const PRIORITY_LABELS: Record<number, string> = { 1: 'high', 2: 'medium', 3: 'low' }
const STATUS_OPTIONS = [
  { value: 'open', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>
}) {
  const profile = await requireStaff()
  const supabase = await createClient()
  const canSeeAll = profile.role === 'admin' || profile.role === 'management' || profile.role === 'operations'

  const { tab = 'my_tasks', status = '' } = await searchParams
  const showAll = tab === 'all_tasks' && canSeeAll
  let query = supabase
    .from('tasks')
    .select('*, assignee:profiles!assigned_to(full_name), company:companies(name), order:orders(order_number)')
    .order('due_at', { ascending: true })
  if (!showAll) query = query.eq('assigned_to', profile.id)
  if (status) query = query.eq('status', status)

  const [{ data: tasks }, { data: team }, { data: companies }, { data: orders }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name').not('role', 'in', '(client_admin,client_user)').order('full_name'),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('orders').select('id, order_number, company_id').order('created_at', { ascending: false }).limit(100),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Tasks</h1>
        <p className="text-xs text-gray-500 mt-1">
          Employees see work assigned to them. Admin and management can view and reassign everything.
        </p>
      </div>

      <form action={asFormAction(createTask)} className="grid grid-cols-1 items-end gap-3 rounded-2xl border bg-white p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Task title</span>
          <input name="title" required placeholder="e.g. Follow up with client" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <SheetDateField name="due_at" label="Due date" showDesktopLabel />
        <MobileSheetSelect
          name="priority"
          label="Priority"
          defaultValue="2"
          showDesktopLabel
          options={[
            { value: '1', label: 'High' },
            { value: '2', label: 'Medium' },
            { value: '3', label: 'Low' },
          ]}
        />
        <MobileSheetSelect
          name="assigned_to"
          label="Assigned to"
          defaultValue={profile.id}
          showDesktopLabel
          options={(team || []).map((p) => ({ value: p.id, label: p.full_name || 'Unnamed' }))}
        />
        <MobileSheetSelect
          name="company_id"
          label="Company"
          emptyLabel="Company (optional)"
          showDesktopLabel
          options={[
            { value: '', label: 'Company (optional)' },
            ...(companies || []).map((company) => ({ value: company.id, label: company.name })),
          ]}
        />
        <MobileSheetSelect
          name="order_id"
          label="Related order"
          emptyLabel="Related order (optional)"
          showDesktopLabel
          className="sm:col-span-2 lg:col-span-2"
          options={[
            { value: '', label: 'Related order (optional)' },
            ...(orders || []).map((order) => ({
              value: order.id,
              label: order.order_number || order.id.slice(0, 8),
            })),
          ]}
        />
        <label className="block space-y-1 sm:col-span-2 lg:col-span-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Notes</span>
          <input name="description" placeholder="Optional details" className="min-h-11 w-full rounded-lg border px-3 py-2" />
        </label>
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1A3022] px-4 py-2.5 font-semibold text-white sm:col-span-2 lg:col-span-4">
          Create task
        </button>
      </form>

      <div className="md:hidden">
        <MobileFilterBar
          pathname="/crm/tasks"
          preserveParams={canSeeAll ? {} : { tab }}
          fields={[
            {
              key: 'status',
              label: 'Status',
              value: status,
              emptyLabel: 'All statuses',
              options: [
                { value: '', label: 'All statuses' },
                ...STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
              ],
            },
            ...(canSeeAll
              ? [
                  {
                    key: 'tab',
                    label: 'Scope',
                    value: tab,
                    emptyLabel: 'My tasks',
                    options: [
                      { value: 'my_tasks', label: 'My tasks' },
                      { value: 'all_tasks', label: 'All tasks' },
                    ],
                  },
                ]
              : []),
          ]}
        />
      </div>
      <div className="hidden flex-wrap gap-4 border-b md:flex">
        <Link href="?tab=my_tasks" className={`px-1 pb-2 text-sm ${tab === 'my_tasks' ? 'border-b-2 border-[#1A3022] font-semibold' : 'text-gray-500'}`}>My Tasks</Link>
        {canSeeAll && (
          <Link href="?tab=all_tasks" className={`px-1 pb-2 text-sm ${tab === 'all_tasks' ? 'border-b-2 border-[#1A3022] font-semibold' : 'text-gray-500'}`}>All Tasks</Link>
        )}
        {STATUS_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`?tab=${tab}&status=${option.value}`}
            className={`px-1 pb-2 text-sm ${status === option.value ? 'border-b-2 border-[#1A3022] font-semibold' : 'text-gray-500'}`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="p-3">Title</th>
              <th className="p-3">Company / Order</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Assigned To</th>
              <th className="p-3">Due</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(tasks || []).map((task) => {
              const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
              const company = Array.isArray(task.company) ? task.company[0] : task.company
              const order = Array.isArray(task.order) ? task.order[0] : task.order
              const priority = typeof task.priority === 'number' ? PRIORITY_LABELS[task.priority] || String(task.priority) : task.priority
              const overdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done' && !task.completed_at
              return (
                <tr key={task.id} className="border-b">
                  <td className="p-3 font-medium">{task.title}</td>
                  <td className="p-3 text-xs text-gray-600">
                    <div>{company?.name || '—'}</div>
                    {order?.order_number && (
                      <Link href={`/crm/orders/${task.order_id}`} className="font-mono text-[#4A235A]">{order.order_number}</Link>
                    )}
                  </td>
                  <td className="p-3 capitalize">{priority}</td>
                  <td className="p-3">
                    {canSeeAll ? (
                      <form action={asFormAction(reassignTask)} className="flex min-w-[140px] flex-col gap-1">
                        <input type="hidden" name="id" value={task.id} />
                        <MobileSheetSelect
                          name="assigned_to"
                          label="Assigned to"
                          defaultValue={task.assigned_to || ''}
                          options={(team || []).map((member) => ({
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
                  <td className={`p-3 ${overdue ? 'text-red-600 font-semibold' : ''}`}>{formatDate(task.due_at)}</td>
                  <td className="p-3">
                    <form action={asFormAction(updateTaskStatus)} className="flex min-w-[140px] flex-col gap-1">
                      <input type="hidden" name="id" value={task.id} />
                      <MobileSheetSelect
                        name="status"
                        label="Status"
                        defaultValue={task.status || 'open'}
                        options={STATUS_OPTIONS.map((option) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                      />
                      <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Update</button>
                    </form>
                    {task.status !== 'done' && !task.completed_at && (
                      <form action={asFormAction(completeTask)} className="mt-1">
                        <input type="hidden" name="id" value={task.id} />
                        <button className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#1A3022] px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#F4EFE6]">Complete</button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {(!tasks || tasks.length === 0) && (
              <tr><td colSpan={6} className="p-4 text-center text-gray-500">No tasks found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
