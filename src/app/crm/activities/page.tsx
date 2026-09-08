import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logActivity, removeActivity } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'
import { MobileFilterBar, MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase
    .from('activities')
    .select('*, creator:profiles!created_by(full_name), assignee:profiles!assigned_to(full_name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (params.type) query = query.eq('type', params.type)
  const [{ data: activities }, { data: team }] = await Promise.all([
    query,
    supabase.from('profiles').select('id, full_name').not('role', 'in', '(client_admin,client_user)').order('full_name'),
  ])

  const getIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞'
      case 'email': return '✉️'
      case 'meeting': return '🤝'
      case 'message': return '💬'
      case 'follow_up': return '📌'
      default: return '📝'
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Activity Feed</h1>

      <form action={asFormAction(logActivity)} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-2">
        <input name="title" required placeholder="Activity title" className="rounded-lg border px-2 py-2 md:col-span-2" />
        <MobileSheetSelect
          name="type"
          label="Type"
          defaultValue="follow_up"
          options={[
            { value: 'follow_up', label: 'Follow-up' },
            { value: 'call', label: 'Call' },
            { value: 'email', label: 'Email' },
            { value: 'meeting', label: 'Meeting' },
            { value: 'message', label: 'Message' },
          ]}
        />
        <input name="due_at" type="datetime-local" className="min-h-11 rounded-lg border px-2 py-2 md:min-h-0" />
        <MobileSheetSelect
          name="assigned_to"
          label="Assigned to"
          defaultValue={user.id}
          options={(team || []).map((p) => ({ value: p.id, label: p.full_name || 'Unnamed' }))}
        />
        <MobileSheetSelect
          name="related_type"
          label="Related record"
          emptyLabel="None (optional)"
          options={[
            { value: '', label: 'None (optional)' },
            { value: 'company', label: 'Company' },
            { value: 'lead', label: 'Lead' },
            { value: 'requirement', label: 'Requirement' },
            { value: 'order', label: 'Order' },
          ]}
        />
        <input name="related_id" placeholder="Related record ID" className="rounded-lg border px-2 py-2" />
        <textarea name="notes" placeholder="Notes" className="min-h-[70px] rounded-lg border px-2 py-2 md:col-span-2" />
        <button className="rounded-lg bg-[#1A3022] py-2.5 font-semibold text-white md:col-span-2">Log activity</button>
      </form>

      <div className="md:hidden">
        <MobileFilterBar
          pathname="/crm/activities"
          fields={[
            {
              key: 'type',
              label: 'Type',
              value: params.type || '',
              emptyLabel: 'All types',
              options: [
                { value: '', label: 'All types' },
                { value: 'call', label: 'Calls' },
                { value: 'email', label: 'Emails' },
                { value: 'meeting', label: 'Meetings' },
                { value: 'follow_up', label: 'Follow-ups' },
                { value: 'message', label: 'Messages' },
              ],
            },
          ]}
        />
      </div>
      <form className="hidden md:block">
        <select name="type" defaultValue={params.type || ''} className="rounded border bg-white p-2 text-sm">
          <option value="">All types</option>
          <option value="call">Calls</option>
          <option value="email">Emails</option>
          <option value="meeting">Meetings</option>
          <option value="follow_up">Follow-ups</option>
          <option value="message">Messages</option>
        </select>
        <button type="submit" className="ml-2 text-sm underline">Filter</button>
      </form>

      <div className="bg-white rounded-lg border p-6">
        <div className="relative border-l border-gray-200 ml-4 space-y-8">
          {(activities || []).map((activity) => {
            const creator = Array.isArray(activity.creator) ? activity.creator[0] : activity.creator
            return (
              <div key={activity.id} className="relative pl-8">
                <div className="absolute -left-4 top-1 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm border">
                  {getIcon(activity.type)}
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-semibold capitalize">{String(activity.type || '').replace('_', ' ')}</span>
                      <span className="text-gray-500 text-sm mx-2">by</span>
                      <span className="font-medium">{creator?.full_name || 'System'}</span>
                    </div>
                    <span className="text-xs text-gray-500">{formatDateTime(activity.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium">{activity.title}</p>
                  {activity.related_type && (
                    <p className="text-xs text-[#1A3022] mt-1">
                      {activity.related_type}
                      {activity.related_id ? (
                        <Link href={
                          activity.related_type === 'requirement' ? `/crm/requirements/${activity.related_id}` :
                          activity.related_type === 'order' ? `/crm/orders/${activity.related_id}` :
                          activity.related_type === 'lead' ? `/crm/leads/${activity.related_id}` :
                          activity.related_type === 'company' ? `/crm/companies/${activity.related_id}` : '#'
                        } className="underline ml-1">open</Link>
                      ) : null}
                    </p>
                  )}
                  {activity.notes && <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{activity.notes}</p>}
                  <div className="mt-3">
                    <ConfirmAction
                      title="Delete activity?"
                      confirmLabel="Delete"
                      action={asFormAction(removeActivity)}
                      hiddenFields={{ id: activity.id }}
                      description={<p>Activity: <span className="font-semibold">{activity.title}</span></p>}
                    >
                      Delete
                    </ConfirmAction>
                  </div>
                </div>
              </div>
            )
          })}
          {(!activities || activities.length === 0) && (
            <p className="text-gray-500 italic pl-8">No activities found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
