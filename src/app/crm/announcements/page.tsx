import { createClient } from '@/lib/supabase/server'
import { formatDateTime, asRows, oneRelation } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { createAnnouncement, updateAnnouncement, removeAnnouncement } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'

type AnnouncementRow = {
  id: string
  title: string
  body: string
  created_at: string
  author?: { full_name: string | null } | { full_name: string | null }[] | null
}

export default async function AnnouncementsPage() {
  const profile = await requireStaff()
  const supabase = await createClient()
  const canPost = profile.role === 'admin' || profile.role === 'management'

  const { data: announcements } = await supabase
    .from('announcements')
    .select('*, author:created_by(full_name)')
    .order('created_at', { ascending: false })
  const announcementRows = asRows<AnnouncementRow>(announcements)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Announcements</h1>
      </div>

      {canPost && (
        <form action={asFormAction(createAnnouncement)} className="bg-white rounded-lg border border-[var(--color-border)] p-4 mb-6 space-y-3">
          <input name="title" required placeholder="Announcement title" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <textarea name="body" required rows={3} placeholder="Message" className="w-full border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white hover:text-white rounded font-medium hover:opacity-90 text-sm">
            Post announcement
          </button>
        </form>
      )}

      <div className="flex flex-col gap-6">
        {announcementRows.map((ann: AnnouncementRow) => {
          const author = oneRelation(ann.author)
          return (
          <div key={ann.id} className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">{ann.title}</h2>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {formatDateTime(ann.created_at)}
              </span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap mb-4">{ann.body}</p>
            {canPost && (
              <div className="space-y-3 mb-4">
                <form action={asFormAction(updateAnnouncement)} className="grid gap-2">
                  <input type="hidden" name="id" value={ann.id} />
                  <input name="title" defaultValue={ann.title} required className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <textarea name="body" defaultValue={ann.body} required rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <button className="justify-self-start px-3 py-1.5 text-xs font-semibold rounded-lg border">Save</button>
                </form>
                <ConfirmAction
                  title="Delete announcement?"
                  confirmLabel="Delete"
                  action={asFormAction(removeAnnouncement)}
                  hiddenFields={{ id: ann.id }}
                  description={<p>Announcement: <span className="font-semibold">{ann.title}</span></p>}
                >
                  Delete
                </ConfirmAction>
              </div>
            )}
            <div className="text-sm font-medium text-gray-500 border-t border-gray-100 pt-4">
              Posted by {author?.full_name || 'Admin'}
            </div>
          </div>
          )
        })}
        {announcementRows.length === 0 && (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No announcements yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
