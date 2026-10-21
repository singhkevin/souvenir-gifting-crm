import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { completeTask, createTask, reassignTask, updateTaskStatus } from './actions'
import Link from 'next/link'
import { MobileFilterBar, MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

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
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-[#CCC5BD] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              Tasks
            </h1>
            <span className="font-mono text-xs text-[#7C766F]">[ {tasks?.length || 0} ]</span>
          </div>
          <p className="mt-1 text-xs text-[#4A4640]">
            Employees see work assigned to them. Admin and management can view and reassign everything.
          </p>
        </div>
      </div>

      {/* Create Task Form */}
      <ActionForm action={createTask} className="grid grid-cols-1 items-end gap-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-xs sm:grid-cols-2 lg:grid-cols-4" resetOnSuccess>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Task title</span>
          <input
            name="title"
            required
            placeholder="e.g. Follow up with client"
            className="min-h-11 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
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
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Notes</span>
          <input
            name="description"
            placeholder="Optional details"
            className="min-h-11 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-sm text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          />
        </label>
        <SubmitButton
          className="inline-flex min-h-11 items-center justify-center rounded-none bg-[#1C1B1A] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] sm:col-span-2 lg:col-span-4 transition-colors"
          pendingLabel="Creating…"
        >
          Create task
        </SubmitButton>
      </ActionForm>

      {/* Mobile Filter Bar */}
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

      {/* Desktop Tabs */}
      <div className="hidden flex-wrap gap-2 border-b border-[#CCC5BD] pb-2 md:flex">
        <Link
          href="?tab=my_tasks"
          className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
            tab === 'my_tasks'
              ? 'bg-[#1C1B1A] text-[#FCF9F2]'
              : 'text-[#4A4640] hover:bg-[#F6F3EC]'
          }`}
        >
          My Tasks
        </Link>
        {canSeeAll && (
          <Link
            href="?tab=all_tasks"
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
              tab === 'all_tasks'
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            All Tasks
          </Link>
        )}
        {STATUS_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`?tab=${tab}&status=${option.value}`}
            className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none ${
              status === option.value
                ? 'bg-[#1C1B1A] text-[#FCF9F2]'
                : 'text-[#4A4640] hover:bg-[#F6F3EC]'
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {(tasks || []).map((task) => {
          const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
          const company = Array.isArray(task.company) ? task.company[0] : task.company
          const order = Array.isArray(task.order) ? task.order[0] : task.order
          const priority = typeof task.priority === 'number' ? PRIORITY_LABELS[task.priority] || String(task.priority) : task.priority
          const overdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done' && !task.completed_at
          return (
            <div key={task.id} className="bg-[#FCF9F2] border border-[#CCC5BD] p-4 rounded-none space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-sm text-[#1C1B1A]">{task.title}</div>
                <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] rounded-none ${
                  priority === 'high' ? 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30' : 'border border-[#CCC5BD] text-[#4A4640]'
                }`}>
                  {priority}
                </span>
              </div>

              <div className="text-xs space-y-1 pt-2 border-t border-[#CCC5BD] text-[#4A4640]">
                {company?.name ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company:</span> {company.name}
                  </div>
                ) : null}
                {order?.order_number ? (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order:</span>{' '}
                    <Link href={`/crm/orders/${task.order_id}`} className="font-mono text-xs text-[#9E4300] hover:underline">
                      {order.order_number}
                    </Link>
                  </div>
                ) : null}
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Due:</span>{' '}
                  <span className={`font-mono text-xs ${overdue ? 'text-[#BA1A1A] font-semibold' : ''}`}>{formatDate(task.due_at)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Assigned:</span>{' '}
                  <span>{assignee?.full_name || 'Unassigned'}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-[#CCC5BD] space-y-2">
                <ActionForm action={updateTaskStatus} className="flex flex-col gap-1.5">
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
                  <SubmitButton
                    className="inline-flex min-h-8 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] transition-colors"
                    pendingLabel="Updating…"
                  >
                    Update
                  </SubmitButton>
                </ActionForm>
                {task.status !== 'done' && !task.completed_at && (
                  <ActionForm action={completeTask} className="mt-1">
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton
                      className="inline-flex min-h-8 w-full items-center justify-center rounded-none border border-[#1C1B1A] bg-transparent px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors"
                      pendingLabel="Completing…"
                    >
                      Complete
                    </SubmitButton>
                  </ActionForm>
                )}
              </div>
            </div>
          )
        })}
        {(!tasks || tasks.length === 0) && (
          <div className="p-8 text-center text-sm text-[#7C766F] bg-[#FCF9F2] border border-[#CCC5BD] rounded-none">
            No tasks found.
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-[#FCF9F2] border border-[#CCC5BD] rounded-none overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-[#F6F3EC] border-b border-[#CCC5BD] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              <th className="py-3 px-4 font-bold text-left">Title</th>
              <th className="py-3 px-4 font-bold text-left">Company / Order</th>
              <th className="py-3 px-4 font-bold text-left">Priority</th>
              <th className="py-3 px-4 font-bold text-left">Assigned To</th>
              <th className="py-3 px-4 font-bold text-left">Due</th>
              <th className="py-3 px-4 font-bold text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {(tasks || []).map((task) => {
              const assignee = Array.isArray(task.assignee) ? task.assignee[0] : task.assignee
              const company = Array.isArray(task.company) ? task.company[0] : task.company
              const order = Array.isArray(task.order) ? task.order[0] : task.order
              const priority = typeof task.priority === 'number' ? PRIORITY_LABELS[task.priority] || String(task.priority) : task.priority
              const overdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done' && !task.completed_at
              return (
                <tr key={task.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-sm text-[#1C1B1A] align-top">{task.title}</td>
                  <td className="py-2.5 px-4 text-xs text-[#4A4640] align-top">
                    <div className="font-medium text-sm text-[#1C1B1A]">{company?.name || '—'}</div>
                    {order?.order_number && (
                      <Link href={`/crm/orders/${task.order_id}`} className="font-mono text-xs text-[#9E4300] hover:underline mt-0.5 inline-block">
                        {order.order_number}
                      </Link>
                    )}
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] rounded-none ${
                      priority === 'high' ? 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30' : 'border border-[#CCC5BD] text-[#4A4640]'
                    }`}>
                      {priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    {canSeeAll ? (
                      <ActionForm action={reassignTask} className="flex min-w-[140px] flex-col gap-1.5">
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
                        <SubmitButton
                          className="inline-flex min-h-8 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] transition-colors"
                          pendingLabel="Saving…"
                        >
                          Save
                        </SubmitButton>
                      </ActionForm>
                    ) : (
                      <span className="text-sm text-[#4A4640]">{assignee?.full_name || 'Unassigned'}</span>
                    )}
                  </td>
                  <td className={`py-2.5 px-4 align-top font-mono text-xs ${overdue ? 'text-[#BA1A1A] font-semibold' : 'text-[#4A4640]'}`}>
                    {formatDate(task.due_at)}
                  </td>
                  <td className="py-2.5 px-4 align-top">
                    <ActionForm action={updateTaskStatus} className="flex min-w-[140px] flex-col gap-1.5">
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
                      <SubmitButton
                        className="inline-flex min-h-8 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] hover:text-[#FCF9F2] transition-colors"
                        pendingLabel="Updating…"
                      >
                        Update
                      </SubmitButton>
                    </ActionForm>
                    {task.status !== 'done' && !task.completed_at && (
                      <ActionForm action={completeTask} className="mt-1.5">
                        <input type="hidden" name="id" value={task.id} />
                        <SubmitButton
                          className="inline-flex min-h-8 items-center justify-center rounded-none border border-[#1C1B1A] bg-transparent px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors"
                          pendingLabel="Completing…"
                        >
                          Complete
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              )
            })}
            {(!tasks || tasks.length === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-[#7C766F]">
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
