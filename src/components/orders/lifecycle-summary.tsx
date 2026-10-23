import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'
import { LINE_STAGES, LINE_STAGE_LABELS, RUNNER_JOB_KIND_LABELS } from '@/lib/orders/line-lifecycle'
import { formatDate } from '@/lib/utils'

type JobRow = {
  id: string
  order_id: string
  kind: string
  status: string
  scheduled_for: string | null
  order: { order_number: string | null } | { order_number: string | null }[] | null
  assignee: { full_name: string | null } | { full_name: string | null }[] | null
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v
}

/**
 * Line-stage counts, runner jobs that need a person, and count issues, for the Control Center
 * and Department pages. Renders nothing before the line-lifecycle migration.
 */
export async function LifecycleSummary({ supabase }: { supabase: SupabaseClient }) {
  const [linesRes, jobsRes] = await Promise.all([
    supabase.from('order_items').select('id, stage, count_issue, order_id').not('stage', 'in', '(delivered,cancelled)').limit(2000),
    supabase
      .from('runner_jobs')
      .select('id, order_id, kind, status, scheduled_for, order:orders(order_number), assignee:assigned_to(full_name)')
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('scheduled_for', { ascending: true, nullsFirst: false })
      .limit(50),
  ])
  if (linesRes.error || jobsRes.error) return null
  const lines = (linesRes.data || []) as { id: string; stage: string; count_issue: string | null; order_id: string }[]
  const jobs = (jobsRes.data || []) as unknown as JobRow[]
  const byStage = new Map<string, number>()
  for (const l of lines) byStage.set(l.stage, (byStage.get(l.stage) || 0) + 1)
  const issues = lines.filter((l) => l.count_issue)
  const unassigned = jobs.filter((j) => j.status === 'open')

  return (
    <section className="space-y-3 border border-[#E5DFD5] bg-[#FAF7F2] p-3 text-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#1C1C18]">Product lines in progress</h2>
        <Link href="/crm/runs" className="text-[#9E4300] underline">Runner jobs</Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {LINE_STAGES.filter((s) => s !== 'delivered').map((stage) => (
          <span key={stage} className="border border-[#E5DFD5] bg-white px-2 py-1">
            {LINE_STAGE_LABELS[stage]} · <strong>{byStage.get(stage) || 0}</strong>
          </span>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <div className="mb-1 font-semibold text-[#1C1C18]">Runner jobs needing a person ({unassigned.length})</div>
          {unassigned.length === 0 ? (
            <p className="text-[#7A7267]">All runner jobs are assigned.</p>
          ) : (
            <ul className="space-y-1">
              {unassigned.slice(0, 8).map((j) => (
                <li key={j.id}>
                  <Link href={`/crm/orders/${j.order_id}?tab=fulfilment`} className="hover:text-[#9E4300]">
                    {one(j.order)?.order_number || 'Order'} · {RUNNER_JOB_KIND_LABELS[j.kind] || j.kind}
                    {j.scheduled_for ? ` · ${formatDate(j.scheduled_for)}` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 font-semibold text-[#1C1C18]">Count issues ({issues.length})</div>
          {issues.length === 0 ? (
            <p className="text-[#7A7267]">No short or damaged counts open.</p>
          ) : (
            <ul className="space-y-1">
              {issues.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <Link href={`/crm/orders/${l.order_id}?tab=fulfilment`} className="text-[#9E4300] hover:underline">
                    {l.count_issue}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
