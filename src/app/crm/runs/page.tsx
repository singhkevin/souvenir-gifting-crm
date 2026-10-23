import Link from 'next/link'
import { isOpsStaff, requireRunnerOrOps } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lineLifecycleEnabled, loadLifecycleSettings } from '@/lib/orders/line-lifecycle-server'
import { RUNNER_JOB_KIND_LABELS, RUNNER_JOB_STATUS_LABELS } from '@/lib/orders/line-lifecycle'
import { formatDate } from '@/lib/utils'
import { RunnerJobCard, type RunnerJobView } from '@/components/runs/runner-job-card'

export const dynamic = 'force-dynamic'

type JobRow = {
  id: string
  order_id: string
  kind: string
  status: string
  assigned_to: string | null
  scheduled_for: string | null
  from_label: string | null
  to_label: string | null
  address: string | null
  contact_phone: string | null
  delivery_id: string | null
  notes: string | null
  completed_at: string | null
}

const JOB_COLUMNS =
  'id, order_id, kind, status, assigned_to, scheduled_for, from_label, to_label, address, contact_phone, delivery_id, notes, completed_at'

export default async function RunsPage() {
  const profile = await requireRunnerOrOps()
  const isRunner = profile.role === 'runner'
  const supabase = await createClient()

  if (!(await lineLifecycleEnabled(supabase))) {
    return (
      <div className="space-y-2 p-4">
        <h1 className="text-xl font-semibold text-[var(--color-primary)]">My runs</h1>
        <p className="text-sm text-[#7A7267]">
          Runner jobs become available once the order line lifecycle update is switched on.
        </p>
      </div>
    )
  }

  // RLS decides which jobs this person may see: runners only their own, ops all.
  let activeQuery = supabase
    .from('runner_jobs')
    .select(JOB_COLUMNS)
    .in('status', isRunner ? ['assigned', 'in_progress'] : ['open', 'assigned', 'in_progress'])
    .order('scheduled_for', { ascending: true, nullsFirst: false })
    .limit(100)
  if (isRunner) activeQuery = activeQuery.eq('assigned_to', profile.id)
  let doneQuery = supabase
    .from('runner_jobs')
    .select(JOB_COLUMNS)
    .eq('status', 'done')
    .order('completed_at', { ascending: false })
    .limit(isRunner ? 10 : 20)
  if (isRunner) doneQuery = doneQuery.eq('assigned_to', profile.id)

  const [{ data: activeData }, { data: doneData }, settings] = await Promise.all([
    activeQuery,
    doneQuery,
    // Runners cannot read the settings row under RLS; it holds no secrets.
    loadLifecycleSettings(createAdminClient() ?? supabase),
  ])
  const active = (activeData || []) as JobRow[]
  const done = (doneData || []) as JobRow[]

  // Details runners cannot read directly (orders, items, delivery lines) come from the service
  // client, limited to the jobs RLS has just returned for this person.
  const reader = createAdminClient() ?? supabase
  const jobIds = active.map((j) => j.id)
  const orderIds = [...new Set([...active, ...done].map((j) => j.order_id))]
  const deliveryIds = active.map((j) => j.delivery_id).filter((x): x is string => Boolean(x))
  const assigneeIds = [...new Set(active.map((j) => j.assigned_to).filter((x): x is string => Boolean(x)))]

  const [ordersRes, jobLinesRes, deliveryLinesRes, peopleRes] = await Promise.all([
    orderIds.length
      ? reader.from('orders').select('id, order_number, company:companies(name)').in('id', orderIds)
      : Promise.resolve({ data: [] as unknown[] }),
    jobIds.length
      ? reader
          .from('runner_job_lines')
          .select('runner_job_id, order_item_id, expected_qty, item:order_items(description, product:products(name))')
          .in('runner_job_id', jobIds)
      : Promise.resolve({ data: [] as unknown[] }),
    deliveryIds.length
      ? reader
          .from('delivery_lines')
          .select('delivery_id, order_item_id, qty_sent, item:order_items(description, product:products(name))')
          .in('delivery_id', deliveryIds)
      : Promise.resolve({ data: [] as unknown[] }),
    !isRunner && assigneeIds.length
      ? supabase.from('profiles').select('id, full_name').in('id', assigneeIds)
      : Promise.resolve({ data: [] as unknown[] }),
  ])

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)
  type ItemRef = { description: string | null; product: { name: string | null } | { name: string | null }[] | null }
  const itemName = (item: ItemRef | ItemRef[] | null) => {
    const i = one(item)
    return one(i?.product ?? null)?.name || i?.description || 'Product'
  }
  const orderById = new Map(
    ((ordersRes.data || []) as { id: string; order_number: string; company: { name: string } | { name: string }[] | null }[]).map((o) => [
      o.id,
      { number: o.order_number, client: one(o.company)?.name || '' },
    ]),
  )
  const people = new Map(((peopleRes.data || []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name || '']))
  const jobLines = (jobLinesRes.data || []) as { runner_job_id: string; order_item_id: string; expected_qty: number; item: ItemRef | ItemRef[] | null }[]
  const deliveryLines = (deliveryLinesRes.data || []) as { delivery_id: string; order_item_id: string; qty_sent: number; item: ItemRef | ItemRef[] | null }[]

  const views: RunnerJobView[] = active.map((j) => {
    const lines =
      j.kind === 'delivery' && j.delivery_id
        ? deliveryLines
            .filter((l) => l.delivery_id === j.delivery_id)
            .map((l) => ({ id: l.order_item_id, name: itemName(l.item), expected: l.qty_sent }))
        : jobLines
            .filter((l) => l.runner_job_id === j.id)
            .map((l) => ({ id: l.order_item_id, name: itemName(l.item), expected: l.expected_qty }))
    const order = orderById.get(j.order_id)
    return {
      id: j.id,
      orderId: j.order_id,
      orderNumber: order?.number || '',
      client: isRunner ? '' : order?.client || '',
      kind: j.kind,
      kindLabel: RUNNER_JOB_KIND_LABELS[j.kind] || j.kind,
      status: j.status,
      statusLabel: RUNNER_JOB_STATUS_LABELS[j.status] || j.status,
      scheduledFor: j.scheduled_for ? formatDate(j.scheduled_for) : null,
      from: j.from_label,
      to: j.to_label,
      address: j.address,
      contactPhone: j.contact_phone,
      notes: j.notes,
      deliveryId: j.delivery_id,
      assignee: j.assigned_to ? people.get(j.assigned_to) || null : null,
      mine: j.assigned_to === profile.id,
      lines,
    }
  })

  return (
    <div className="space-y-5 p-1">
      <div>
        <h1 className="text-xl font-semibold text-[var(--color-primary)]">{isRunner ? 'My runs' : 'Runner jobs'}</h1>
        <p className="mt-1 text-xs text-[#7A7267]">
          {isRunner
            ? 'Pickups, printer handovers and deliveries assigned to you. Count every box before you leave.'
            : 'Every open pickup, handover and delivery. Assign people from the order’s Fulfilment tab.'}
        </p>
      </div>

      {views.length === 0 ? (
        <p className="border border-[#E5DFD5] bg-white p-4 text-sm text-[#7A7267]">
          {isRunner ? 'Nothing assigned to you right now.' : 'No open runner jobs.'}
        </p>
      ) : (
        <div className="space-y-3">
          {views.map((job) => (
            <RunnerJobCard
              key={job.id}
              job={job}
              isRunner={isRunner}
              readOnly={!isRunner && !isOpsStaff(profile.role)}
              requireSignature={settings.require_signature}
              requireSealPhoto={settings.require_seal_photo}
            />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[#1C1C18]">Recently done</h2>
          <ul className="divide-y divide-[#EFE9E0] border border-[#E5DFD5] bg-white text-xs">
            {done.map((j) => (
              <li key={j.id} className="flex justify-between gap-2 px-3 py-2">
                <span>
                  {orderById.get(j.order_id)?.number || 'Order'} · {RUNNER_JOB_KIND_LABELS[j.kind] || j.kind}
                </span>
                <span className="text-[#7A7267]">{formatDate(j.completed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isRunner && (
        <p className="text-[11px] text-[#7A7267]">
          <Link href="/crm/order-management" className="underline">Back to Order Control Center</Link>
        </p>
      )}
    </div>
  )
}
