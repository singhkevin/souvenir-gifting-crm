import { ProductImage } from '@/components/ui/product-image'
import { formatCurrency } from '@/lib/utils'
import type { PublicSlide } from '@/lib/presentations/rules'

export type DeckViewItem = PublicSlide & { price?: number | null }

export function DeckView({
  title,
  clientName,
  notes,
  items,
  showPrices,
  organisation,
  phone,
}: {
  title: string
  clientName: string
  notes: string
  items: DeckViewItem[]
  showPrices: boolean
  organisation?: string
  phone?: string | null
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl bg-[#F6F4F1] px-6 py-10">
        {organisation ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">{organisation}</p>
        ) : null}
        <h1 className="mt-3 font-serif text-4xl text-[#241C12]">{title}</h1>
        <p className="mt-3 text-sm text-[#5C6570]">Prepared for {clientName}</p>
        {notes ? <p className="mt-4 max-w-xl text-sm text-[#5C6570]">{notes}</p> : null}
      </section>
      {items.map((item, index) => (
        <article key={`${item.title}-${index}`} className="grid gap-4 rounded-2xl border border-[#E8E4DE] bg-white p-4 sm:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="aspect-square overflow-hidden rounded-xl bg-[#F6F4F1]">
            <ProductImage src={item.imageUrl} alt={item.title} size="md" fit="contain" className="h-full w-full bg-transparent" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#806A50]">
              {item.kind === 'combo' ? 'Combo' : 'Product'}
            </p>
            <h2 className="mt-1 font-serif text-2xl text-[#241C12]">{item.title}</h2>
            {item.memberNames.length ? (
              <p className="mt-2 text-sm text-[#5C6570]">{item.memberNames.join(' · ')}</p>
            ) : null}
            {item.specs ? <p className="mt-3 text-sm text-[#1B2430]">{item.specs}</p> : null}
            <p className="mt-4 text-sm text-[#5C6570]">MOQ {item.moq}</p>
            {showPrices && item.price != null ? (
              <p className="mt-1 text-lg font-semibold text-[#241C12]">{formatCurrency(item.price)}</p>
            ) : null}
          </div>
        </article>
      ))}
      <section className="rounded-2xl bg-[#241C12] px-6 py-8 text-white">
        <p className="font-serif text-3xl">{organisation || 'Thank you'}</p>
        <p className="mt-3 text-sm text-[#E8E4DE]">
          {phone ? `Contact ${phone}` : 'Contact the team through the public website.'}
        </p>
      </section>
    </div>
  )
}
