import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createReview, updateReview, removeReview } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'management') {
    redirect('/crm/access-denied')
  }

  const [{ data: reviews }, { data: companies }, { data: orders }] = await Promise.all([
    supabase.from('reviews').select('*, company:companies(name), order:orders(order_number)').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
    supabase.from('orders').select('id, order_number, company_id').order('created_at', { ascending: false }).limit(40),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Client Reviews</h1>

      <form action={asFormAction(createReview)} className="bg-white border rounded-2xl p-4 grid md:grid-cols-2 gap-3 text-xs">
        <MobileSheetSelect
          name="company_id"
          label="Company"
          required
          emptyLabel="Company"
          options={[
            { value: '', label: 'Company' },
            ...(companies || []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <MobileSheetSelect
          name="order_id"
          label="Related order"
          emptyLabel="Related order (optional)"
          options={[
            { value: '', label: 'Related order (optional)' },
            ...(orders || []).map((o) => ({
              value: o.id,
              label: o.order_number || o.id.slice(0, 8),
            })),
          ]}
        />
        <MobileSheetSelect
          name="rating"
          label="Rating"
          defaultValue="5"
          options={[5, 4, 3, 2, 1].map((n) => ({
            value: String(n),
            label: `${n} star${n === 1 ? '' : 's'}`,
          }))}
        />
        <input name="feedback" placeholder="Feedback" className="border rounded-lg px-2 py-2" />
        <button className="bg-[#1A3022] text-white rounded-lg font-semibold md:col-span-2 py-2">Log review</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        {reviews && reviews.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="p-3">Date</th>
                <th className="p-3">Company</th>
                <th className="p-3">Order</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Feedback</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const company = Array.isArray(review.company) ? review.company[0] : review.company
                const order = Array.isArray(review.order) ? review.order[0] : review.order
                return (
                  <tr key={review.id} className="border-b text-sm">
                    <td className="p-3">{formatDate(review.created_at)}</td>
                    <td className="p-3">
                      <Link href={`/crm/companies/${review.company_id}`} className="text-blue-600 hover:underline">{company?.name}</Link>
                    </td>
                    <td className="p-3">
                      {review.order_id ? (
                        <Link href={`/crm/orders/${review.order_id}`} className="text-blue-600 hover:underline">{order?.order_number}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-amber-500">{'★'.repeat(review.rating || 0)}{'☆'.repeat(5 - (review.rating || 0))}</td>
                    <td className="p-3">{review.feedback || '—'}</td>
                    <td className="p-3 text-xs space-y-2">
                      <form action={asFormAction(updateReview)} className="flex flex-col gap-1">
                        <input type="hidden" name="id" value={review.id} />
                        <MobileSheetSelect
                          name="rating"
                          label="Rating"
                          defaultValue={String(review.rating || 5)}
                          options={[5, 4, 3, 2, 1].map((n) => ({
                            value: String(n),
                            label: `${n} stars`,
                          }))}
                        />
                        <input name="feedback" defaultValue={review.feedback || ''} className="border rounded px-2 py-1" />
                        <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Save</button>
                      </form>
                      <ConfirmAction
                        title="Delete review?"
                        confirmLabel="Delete"
                        action={asFormAction(removeReview)}
                        hiddenFields={{ id: review.id }}
                        description={<p>This removes the logged review for {company?.name || 'this company'}.</p>}
                      >
                        Delete
                      </ConfirmAction>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">No client reviews found.</div>
        )}
      </div>
    </div>
  )
}
