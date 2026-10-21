import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { publicDeckContact } from '@/lib/presentations/contact'
import { DeckView, type DeckViewItem } from '@/components/presentations/deck-view'
import { publicSlide } from '@/lib/presentations/rules'

export const dynamic = 'force-dynamic'

type Payload = {
  title: string
  client_name: string
  notes: string
  show_prices?: boolean
  items: {
    title: string
    image_url: string | null
    specs: string
    moq: number
    price?: number | null
    kind: 'product' | 'combo'
    member_names: string[]
  }[]
}

export default async function PublicPresentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('presentation_public', { p_token: token })
  if (error) {
    return (
      <div className="border border-[#E8E4DE] bg-white p-6">
        <h1 className="font-serif text-3xl">Presentation</h1>
        <p className="mt-3 text-sm text-[#5C6570]">This link is not available yet.</p>
      </div>
    )
  }
  const payload = data as Payload | null
  if (!payload?.title) notFound()
  const contact = await publicDeckContact()
  const showPrices = payload.show_prices !== false
  const items: DeckViewItem[] = (payload.items || []).map((item) => ({
    ...publicSlide({
    title: item.title,
    imageUrl: item.image_url,
    specs: item.specs || '',
    moq: item.moq,
    kind: item.kind,
    memberNames: item.member_names || [],
    }),
    price: showPrices && item.price != null ? Number(item.price) : null,
  }))
  return (
    <DeckView
      title={payload.title}
      clientName={payload.client_name}
      notes={payload.notes || ''}
      items={items}
      showPrices={showPrices}
      organisation={contact.organisation}
      phone={contact.phone}
    />
  )
}
