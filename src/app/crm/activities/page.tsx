import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logActivity, removeActivity } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'

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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Activity Feed</h1>

      <form action={asFormAction(logActivity)} className="bg-white border rounded-2xl p-4 grid md:grid-cols-2 gap-3 text-xs">
        <input name="title" required placeholder="Activity title" className="border rounded-lg px-2 py-2" />
        <select name="type" className="border rounded-lg px-2 py-2">
          <option value="follow_up">Follow-up</option>
          <option value="call">Call</option>
          <option value="email">Email</option>
          <option value="meeting">Meeting</option>
          <option value="message">Message</option>
        </select>
        <input name="due_at" type="datetime-local" className="border rounded-lg px-2 py-2" />
        <select name="assigned_to" defaultValue={user.id} className="border rounded-lg px-2 py-2">
          {(team || []).map((p) => (
            <option key={p.id} value={p.id}>{p.full_name}</option>
          ))}
        </select>
        <select name="related_type" className="border rounded-lg px-2 py-2">
          <option value="">Related record (optional)</option>
          <option value="company">Company</option>
          <option value="lead">Lead</option>
          <option value="requirement">Requirement</option>
          <option value="order">Order</option>
        </select>
        <input name="related_id" placeholder="Related record ID" className="border rounded-lg px-2 py-2" />
        <textarea name="notes" placeholder="Notes" className="md:col-span-2 border rounded-lg px-2 py-2 min-h-[70px]" />
        <button className="bg-[#1A3022] text-white rounded-lg font-semibold md:col-span-2 py-2">Log activity</button>
      </form>

      <form>
        <select name="type" defaultValue={params.type || ''} className="p-2 border rounded text-sm bg-white">
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
