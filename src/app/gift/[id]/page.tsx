import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isGiftEmployeeRole } from '@/lib/roles'
import { isUuid } from '@/lib/utils'
import { giftWindowOpen } from '@/lib/gifts/rules'
import { GiftChooser, type GiftChoiceItem } from '@/components/gifts/gift-chooser'

export const dynamic = 'force-dynamic'

export default async function GiftChoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const profile = await getProfile()
  if (!profile || !isGiftEmployeeRole(profile.role)) redirect('/gift/join')

  const supabase = await createClient()
  const { data: selection } = await supabase
    .from('gift_selections')
    .select('id, name, opens_at, closes_at')
    .eq('id', id)
    .maybeSingle()
  if (!selection) notFound()

  const { data: submission } = await supabase
    .from('gift_selection_submissions')
    .select('employee_name, selected_label, size, phone, address, city, state, pin')
    .eq('selection_id', id)
    .eq('employee_user_id', profile.id)
    .maybeSingle()

  if (submission) {
    return (
      <div className="space-y-4 border border-[#CCC5BD] bg-[#FCF9F2] p-6">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300]">Locked Choice</p>
        <h1 className="font-serif text-3xl text-[#1C1B1A]">{selection.name}</h1>
        <p className="text-sm text-[#4A4640]">Your choice is saved and cannot be edited.</p>
        <dl className="space-y-2 border-t border-[#CCC5BD] pt-4 font-mono text-xs text-[#4A4640]">
          <Line label="Gift" value={submission.selected_label} />
          <Line label="Size" value={submission.size || '—'} />
          <Line label="Name" value={submission.employee_name} />
          <Line label="Phone" value={submission.phone} />
          <Line label="Address" value={submission.address} />
          <Line label="City" value={submission.city} />
          <Line label="State" value={submission.state} />
          <Line label="PIN" value={submission.pin} />
        </dl>
        <div className="pt-2">
          <Link href="/gift" className="inline-block font-sans text-xs font-semibold uppercase tracking-wider text-[#9E4300] hover:underline">
            &larr; Back to gifts
          </Link>
        </div>
      </div>
    )
  }

  if (!giftWindowOpen(selection.opens_at, selection.closes_at)) {
    return (
      <div className="border border-[#E8E4DE] bg-white p-5">
        <h1 className="font-serif text-3xl">{selection.name}</h1>
        <p className="mt-2 text-sm text-[#5C6570]">This gift selection is closed.</p>
      </div>
    )
  }

  const { data: items } = await supabase
    .from('gift_selection_items')
    .select('id, title, image_url, kind, member_names, size_options, sort_order')
    .eq('selection_id', id)
    .order('sort_order')

  const choices: GiftChoiceItem[] = (items || []).map((item) => ({
    id: item.id,
    title: item.title,
    imageUrl: item.image_url,
    kind: item.kind,
    memberNames: item.member_names || [],
    sizeOptions: item.size_options || [],
  }))

  return <GiftChooser selectionId={selection.id} selectionName={selection.name} items={choices} />
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[#F0EBE3] py-2">
      <dt className="text-[#5C6570]">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
