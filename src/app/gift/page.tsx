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
    <div className="space-y-6">
      <div>
        <span className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300] block mb-1">PROGRAMME SELECTION</span>
        <h1 className="font-serif text-3xl text-[#1C1B1A]">Your gift</h1>
        <p className="mt-1 text-sm text-[#4A4640]">Pick one item in each open selection. A submitted choice stays locked.</p>
      </div>
      {(selections || []).length === 0 ? (
        <p className="border border-[#CCC5BD] bg-[#FCF9F2] p-5 text-sm text-[#4A4640]">Nothing is open for your email right now.</p>
      ) : (
        <div className="space-y-4">
          {(selections || []).map((selection) => {
            const mine = submitted.get(selection.id)
            const open = giftWindowOpen(selection.opens_at, selection.closes_at)
            return (
              <Link
                key={selection.id}
                href={`/gift/${selection.id}`}
                className="block border border-[#CCC5BD] bg-[#FCF9F2] p-5 transition-colors hover:border-[#1C1B1A]"
              >
                <p className="font-serif text-xl text-[#1C1B1A]">{selection.name}</p>
                <p className="mt-1 font-mono text-xs text-[#7C766F]">
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
