import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

export default async function PresentationsPage() {
  await requireStaff(['admin', 'sales', 'operations', 'management'])
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('presentations')
    .select('id, title, client_name, updated_at')
    .order('updated_at', { ascending: false })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Presentations</h1>
          <p className="mt-1 text-sm text-gray-500">A deck of products and combos, with a PDF and a public link.</p>
        </div>
        <Link href="/crm/presentations/new" className="rounded-lg bg-[#241C12] px-4 py-2 text-sm font-semibold text-white">
          New presentation
        </Link>
      </div>
      {error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Apply the presentations migration before using this page.
        </p>
      ) : null}
      <div className="divide-y rounded-xl border bg-white">
        {(data || []).length === 0 && !error ? (
          <p className="p-4 text-sm text-gray-500">No presentations yet.</p>
        ) : null}
        {(data || []).map((row) => (
          <Link key={row.id} href={`/crm/presentations/${row.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-gray-50">
            <span>
              <span className="block font-medium text-gray-900">{row.title}</span>
              <span className="text-sm text-gray-500">{row.client_name}</span>
            </span>
            <span className="text-xs text-gray-400">{formatDate(row.updated_at)}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
