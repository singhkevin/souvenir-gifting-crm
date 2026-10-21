import { notFound } from 'next/navigation'
import { DeckView } from '@/components/presentations/deck-view'
import { DeckEditor } from '@/components/presentations/deck-editor'

export const dynamic = 'force-dynamic'

const PRODUCTS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Welcome notebook', sku: 'NB-1', image_url: '/site/home-welcome-kit.webp', description: 'Hardcover notebook with a ribbon.', price: 350, moq: 25 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Steel bottle', sku: 'BTL-1', image_url: '/site/home-festive-cane.webp', description: '500 ml steel bottle.', price: 450, moq: 50 },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Team tee', sku: 'TEE-1', image_url: '/site/home-new-joiner.webp', description: 'Cotton tee.', price: 699, moq: 20 },
]

export default function PresentationPreviewPage() {
  if (process.env.PRESENTATION_UI_PREVIEW !== '1') notFound()
  return (
    <div className="space-y-10">
      <DeckView
        title="Diwali gifting"
        clientName="Northwind"
        notes="A short pitch for the festive order."
        showPrices={false}
        organisation="Souvenir - Gifting Solutions"
        phone={null}
        items={[
          { title: 'Steel bottle', imageUrl: '/site/home-festive-cane.webp', specs: '500 ml steel bottle.', moq: 50, kind: 'product', memberNames: [] },
          { title: 'Desk kit', imageUrl: '/site/home-welcome-kit.webp', specs: 'Notebook and bottle.', moq: 25, kind: 'combo', memberNames: ['Welcome notebook', 'Steel bottle'] },
        ]}
      />
      <section className="border border-[#E8E4DE] bg-white p-4">
        <h2 className="mb-3 font-serif text-2xl">Staff deck</h2>
        <DeckEditor products={PRODUCTS} companies={[{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Northwind' }]} />
      </section>
    </div>
  )
}
