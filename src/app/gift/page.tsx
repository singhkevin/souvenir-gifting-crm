import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isGiftEmployeeRole } from '@/lib/roles'
import { giftWindowOpen } from '@/lib/gifts/rules'

export const dynamic = 'force-dynamic'

export default async function GiftHomePage() {
  const profile = await getProfile()
  if (!profile || !isGiftEmployeeRole(profile.role)) redirect('/gift/join')
  const supabase = await createClient()
  const { data: selections } = await supabase
    .from('gift_selections')
    .select('id, name, opens_at, closes_at')
    .order('opens_at')
  const { data: submissions } = await supabase
    .from('gift_selection_submissions')
    .select('selection_id, selected_label, size')

  const submitted = new Map((submissions || []).map((row) => [row.selection_id, row]))

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Your gift</h1>
      <p className="text-sm text-[#5C6570]">Pick one item in each open selection. A submitted choice stays locked.</p>
      {(selections || []).length === 0 ? (
        <p className="rounded-2xl border border-[#E8E4DE] bg-white p-5 text-sm text-[#5C6570]">Nothing is open for your email right now.</p>
      ) : (
        <div className="space-y-3">
          {(selections || []).map((selection) => {
            const mine = submitted.get(selection.id)
            const open = giftWindowOpen(selection.opens_at, selection.closes_at)
            return (
              <Link key={selection.id} href={`/gift/${selection.id}`} className="block rounded-2xl border border-[#E8E4DE] bg-white p-4">
                <p className="font-medium">{selection.name}</p>
                <p className="mt-1 text-sm text-[#5C6570]">
                  {mine
                    ? `Submitted: ${mine.selected_label}${mine.size ? ` · ${mine.size}` : ''}`
                    : open
                      ? 'Open — choose one gift'
                      : 'Closed'}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
