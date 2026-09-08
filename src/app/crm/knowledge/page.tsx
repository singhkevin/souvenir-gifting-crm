import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { formatDateTime } from '@/lib/utils'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS } from '@/lib/order-workflow'
import Link from 'next/link'

export default async function KnowledgePage() {
  const profile = await requireStaff()
  const supabase = await createClient()
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, title, body, created_at')
    .order('created_at', { ascending: false })
    .limit(12)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="font-serif text-2xl text-[#1C1917]">Knowledge Center</h1>
        <p className="text-xs text-[#7A7267] mt-1">How GIFFTER runs a gift programme — from enquiry to payment.</p>
      </div>

      <section className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-serif text-lg">Order workflow</h2>
        <ol className="space-y-2 text-sm">
          {ORDER_LIFECYCLE.map((st, i) => (
            <li key={st} className="flex gap-3">
              <span className="font-mono text-[11px] text-[#7A7267] w-6">{i + 1}</span>
              <span>{ORDER_STATUS_LABELS[st]}</span>
            </li>
          ))}
        </ol>
        {(profile.role === 'admin' || profile.role === 'operations') && (
          <Link href="/crm/order-management" className="text-xs underline">Open order management</Link>
        )}
      </section>

      <section className="bg-white border rounded-xl p-5 space-y-3">
        <h2 className="font-serif text-lg">Company announcements</h2>
        {(announcements || []).map((a) => (
          <article key={a.id} className="border-b border-[#EFE9E0] pb-3">
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="text-xs text-[#7A7267] mt-1 whitespace-pre-wrap line-clamp-4">{a.body}</p>
            <p className="text-[11px] text-gray-400 mt-1">{formatDateTime(a.created_at)}</p>
          </article>
        ))}
        {(!announcements || announcements.length === 0) && (
          <p className="text-sm text-gray-500">No announcements yet.</p>
        )}
        <Link href="/crm/announcements" className="text-xs underline">All announcements</Link>
      </section>
    </div>
  )
}
