import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { DeckEditor, type DeckProduct } from '@/components/presentations/deck-editor'
import { createPresentation } from '../actions'

export default async function NewPresentationPage() {
  await requireStaff(['admin', 'sales', 'operations', 'management'])
  const supabase = await createClient()
  const [{ data: products }, { data: companies }] = await Promise.all([
    supabase.from('products').select('id, name, sku, image_url, description, price, moq').eq('status', 'active').order('name').limit(80),
    supabase.from('companies').select('id, name').order('name').limit(200),
  ])
  const rows: DeckProduct[] = (products || []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    image_url: product.image_url,
    description: product.description,
    price: Number(product.price) || 0,
    moq: product.moq && product.moq > 0 ? product.moq : 1,
  }))

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold text-gray-900">New presentation</h1>
      <ActionForm action={createPresentation} className="rounded-xl border bg-white p-4">
        <DeckEditor products={rows} companies={companies || []} />
        <SubmitButton className="mt-4 rounded-lg bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving…">
          Save presentation
        </SubmitButton>
      </ActionForm>
    </div>
  )
}
