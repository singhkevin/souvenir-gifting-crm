import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, asRows } from '@/lib/utils'
import { createGoal, updateGoal, removeGoal } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { requireStaff } from '@/lib/auth'
import { applyOrderScope } from '@/lib/auth'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

type TeamMember = { id: string; full_name: string | null | undefined }

type GoalOrder = {
  order_value: number | null
  created_at: string
  owner_id: string | null
  status: string
}

type GoalRow = {
  id: string
  title: string
  metric: string
  target: number | string | null
  period_start: string | null
  period_type: string | null
  owner_id: string | null
  owner?: { full_name: string | null } | { full_name: string | null }[] | null
}

function numericAmount(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export default async function GoalsPage() {
  const profile = await requireStaff(['admin', 'management', 'sales'])
  const supabase = await createClient()

  let goalsQuery = supabase.from('goals').select('*, owner:profiles!owner_id(full_name)').order('created_at', { ascending: false })
  if (profile.role === 'sales') {
    goalsQuery = goalsQuery.or(`owner_id.eq.${profile.id},owner_id.is.null`)
  }

  let orderQuery = applyOrderScope(
    supabase.from('orders').select('order_value, created_at, owner_id, status').in('status', [
      'created', 'confirmed', 'in_progress', 'procurement', 'printing', 'quality_check', 'ready_to_dispatch', 'dispatched', 'delivered',
    ]),
    profile
  )

  const [{ data: goals }, { data: orders }, { data: team }] = await Promise.all([
    goalsQuery,
    orderQuery,
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).order('full_name'),
  ])

  const orderRows = asRows<GoalOrder>(orders)
  const teamRows = asRows<TeamMember>(team)
  const goalsWithProgress = asRows<GoalRow>(goals).map((goal: GoalRow) => {
    let actual = 0
    const target = numericAmount(goal.target)
    if (goal.metric === 'revenue' && orderRows.length > 0) {
      const periodStart = goal.period_start ? new Date(goal.period_start) : new Date()
      const periodEnd = new Date(periodStart)
      if (goal.period_type === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1)
      else if (goal.period_type === 'quarter') periodEnd.setMonth(periodEnd.getMonth() + 3)
      else periodEnd.setMonth(periodEnd.getMonth() + 1)

      const relevantOrders = orderRows.filter((o: GoalOrder) => {
        const d = new Date(o.created_at)
        const isCorrectPeriod = d >= periodStart && d < periodEnd
        const isCorrectOwner = goal.owner_id ? o.owner_id === goal.owner_id : true
        return isCorrectPeriod && isCorrectOwner
      })
      actual = relevantOrders.reduce((acc: number, curr: GoalOrder) => acc + Number(curr.order_value), 0)
    }
    const progress = target ? Math.min(100, Math.max(0, (actual / target) * 100)) : 0
    return { ...goal, actual, progress, target }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Goal Tracker</h1>

      {(profile.role === 'admin' || profile.role === 'management') && (
      <form action={asFormAction(createGoal)} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3">
        <input name="title" required placeholder="Goal title" className="rounded-lg border px-2 py-2" />
        <MobileSheetSelect
          name="metric"
          label="Metric"
          defaultValue="revenue"
          options={[
            { value: 'revenue', label: 'Revenue' },
            { value: 'orders', label: 'Orders' },
          ]}
        />
        <input name="target" type="number" min="1" required placeholder="Target" className="rounded-lg border px-2 py-2" />
        <MobileSheetSelect
          name="period_type"
          label="Period"
          defaultValue="month"
          options={[
            { value: 'month', label: 'Month' },
            { value: 'quarter', label: 'Quarter' },
            { value: 'year', label: 'Year' },
          ]}
        />
        <SheetDateField name="period_start" label="Period start" required />
        <MobileSheetSelect
          name="owner_id"
          label="Owner"
          emptyLabel="Company-wide"
          options={[
            { value: '', label: 'Company-wide' },
            ...teamRows.map((p: TeamMember) => ({ value: p.id, label: p.full_name ?? '' })),
          ]}
        />
        <button className="rounded-lg bg-[#1A3022] py-2.5 font-semibold text-white hover:text-white md:col-span-3">Add goal</button>
      </form>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {goalsWithProgress?.map((goal) => {
          const owner = Array.isArray(goal.owner) ? goal.owner[0] : goal.owner
          return (
            <div key={goal.id} className="bg-white p-6 rounded-lg border">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{goal.title}</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {owner?.full_name || 'Company wide'} · {goal.period_type} from {formatDate(goal.period_start)}
                  </p>
                </div>
                <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium uppercase">{goal.metric}</span>
              </div>
              {(profile.role === 'admin' || profile.role === 'management') && (
                <div className="mb-4 space-y-2 text-xs">
                  <form action={asFormAction(updateGoal)} className="grid md:grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={goal.id} />
                    <input name="title" defaultValue={goal.title} required className="border rounded-lg px-2 py-1" />
                    <input name="target" type="number" min="1" defaultValue={goal.target ?? ''} required className="border rounded-lg px-2 py-1" />
                    <MobileSheetSelect
                      name="metric"
                      label="Metric"
                      defaultValue={goal.metric}
                      options={[
                        { value: 'revenue', label: 'Revenue' },
                        { value: 'orders', label: 'Orders' },
                      ]}
                    />
                    <MobileSheetSelect
                      name="period_type"
                      label="Period"
                      defaultValue={goal.period_type || 'month'}
                      options={[
                        { value: 'month', label: 'Month' },
                        { value: 'quarter', label: 'Quarter' },
                        { value: 'year', label: 'Year' },
                      ]}
                    />
                    <SheetDateField name="period_start" label="Period start" defaultValue={goal.period_start || ''} required />
                    <MobileSheetSelect
                      name="owner_id"
                      label="Owner"
                      defaultValue={goal.owner_id || ''}
                      emptyLabel="Company-wide"
                      options={[
                        { value: '', label: 'Company-wide' },
                        ...teamRows.map((p: TeamMember) => ({ value: p.id, label: p.full_name ?? '' })),
                      ]}
                    />
                    <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Save goal</button>
                  </form>
                  <ConfirmAction
                    title="Delete goal?"
                    confirmLabel="Delete"
                    action={asFormAction(removeGoal)}
                    hiddenFields={{ id: goal.id }}
                    description={<p>Goal: <span className="font-semibold">{goal.title}</span></p>}
                  >
                    Delete
                  </ConfirmAction>
                </div>
              )}
              <div className="mb-2 flex justify-between text-sm">
                <span>Progress</span>
                <span>{goal.progress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div className={`h-2.5 rounded-full ${goal.progress >= 100 ? 'bg-green-500' : goal.progress >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${goal.progress}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <div>
                  <p className="text-[var(--color-text-secondary)]">Actual</p>
                  <p className="font-semibold">{goal.metric === 'revenue' ? formatCurrency(goal.actual) : goal.actual}</p>
                </div>
                <div className="text-right">
                  <p className="text-[var(--color-text-secondary)]">Target</p>
                  <p className="font-semibold">{goal.metric === 'revenue' ? formatCurrency(goal.target) : goal.target}</p>
                </div>
              </div>
            </div>
          )
        })}
        {(!goalsWithProgress || goalsWithProgress.length === 0) && (
          <p className="text-[var(--color-text-secondary)] p-4 col-span-2">No goals defined.</p>
        )}
      </div>
    </div>
  )
}
