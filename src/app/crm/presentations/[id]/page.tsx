import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/auth'
import { isUuid } from '@/lib/utils'
import { storeSiteUrl } from '@/lib/brand'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { DeckEditor, type DeckProduct } from '@/components/presentations/deck-editor'
import { DeckView } from '@/components/presentations/deck-view'
import { linkIsOpen } from '@/lib/presentations/rules'
import { publicDeckContact } from '@/lib/presentations/contact'
import { revokePresentationLink, sharePresentation, updatePresentation } from '../actions'

export default async function PresentationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff(['admin', 'sales', 'operations', 'management'])
  const { id } = await params
  if (!isUuid(id)) notFound()
  const supabase = await createClient()
  const [{ data: deck }, { data: items }, { data: products }, { data: companies }, { data: links }, contact] = await Promise.all([
    supabase.from('presentations').select('id, title, client_name, notes, company_id, show_prices').eq('id', id).maybeSingle(),
    supabase.from('presentation_items').select('id, kind, product_id, title, image_url, specs, price, moq, member_names, sort_order').eq('presentation_id', id).order('sort_order'),
    supabase.from('products').select('id, name, sku, image_url, description, price, moq').eq('status', 'active').order('name').limit(80),
    supabase.from('companies').select('id, name').order('name').limit(200),
    supabase.from('presentation_links').select('token, expires_at, revoked_at, created_at').eq('presentation_id', id).order('created_at', { ascending: false }).limit(5),
    publicDeckContact(),
  ])
  if (!deck) notFound()
  const itemIds = (items || []).map((item) => item.id)
  const { data: comboRows } = itemIds.length
    ? await supabase.from('presentation_combo_products').select('item_id, product_id, sort_order').in('item_id', itemIds).order('sort_order')
    : { data: [] }
  const comboIds = new Map<string, string[]>()
  for (const row of comboRows || []) {
    const list = comboIds.get(row.item_id) || []
    list.push(row.product_id)
    comboIds.set(row.item_id, list)
  }

  const rows: DeckProduct[] = (products || []).map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    image_url: product.image_url,
    description: product.description,
    price: Number(product.price) || 0,
    moq: product.moq && product.moq > 0 ? product.moq : 1,
  }))
  const slides = (items || []).map((item) => ({
    key: item.id,
    kind: item.kind as 'product' | 'combo',
    productId: item.product_id,
    productIds: comboIds.get(item.id) || [],
    title: item.title,
    imageUrl: item.image_url,
    specs: item.specs || '',
    price: String(item.price),
    moq: String(item.moq),
    memberNames: item.member_names || [],
  }))
  const open = (links || []).find((link) => linkIsOpen({ revokedAt: link.revoked_at, expiresAt: link.expires_at }))
  const shareUrl = open ? `${storeSiteUrl()}/present/${open.token}` : ''

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/crm/presentations" className="text-xs text-gray-500">Presentations</Link>
          <h1 className="text-2xl font-semibold text-gray-900">{deck.title}</h1>
        </div>
        <a href={`/crm/presentations/${id}/pdf`} className="rounded-lg border px-4 py-2 text-sm font-semibold">Download PDF</a>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Share link</h2>
        <p className="mt-1 text-sm text-gray-500">The public page shows the deck and hides prices.</p>
        {shareUrl ? (
          <p className="mt-3 break-all text-sm">
            <a href={shareUrl} className="text-[#806A50] underline">{shareUrl}</a>
            {open?.expires_at ? <span className="mt-1 block text-xs text-gray-500">Expires {open.expires_at.slice(0, 10)}</span> : <span className="mt-1 block text-xs text-gray-500">No expiry</span>}
          </p>
        ) : <p className="mt-3 text-sm text-gray-500">No open link.</p>}
        <ActionForm action={sharePresentation} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="id" value={id} />
          <label className="text-xs text-gray-500">
            Expiry
            <select name="expiry" defaultValue="30" className="mt-1 block rounded-lg border px-3 py-2 text-sm">
              <option value="30">30 days</option>
              <option value="date">Custom date</option>
              <option value="none">No expiry</option>
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Custom date
            <input type="date" name="expiry_date" className="mt-1 block rounded-lg border px-3 py-2 text-sm" />
          </label>
          <SubmitButton className="rounded-lg bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving…">
            {open ? 'Regenerate link' : 'Create link'}
          </SubmitButton>
        </ActionForm>
        {open ? (
          <div className="mt-3">
            <ConfirmAction
              title="Revoke this link?"
              description="The public page will stop opening. You can create a new link afterwards."
              confirmLabel="Revoke"
              action={revokePresentationLink}
              hiddenFields={{ id }}
              successMessage="Link revoked"
            >
              <button type="button" className="text-sm text-red-700">Revoke link</button>
            </ConfirmAction>
          </div>
        ) : null}
      </section>

      <ActionForm action={updatePresentation} className="rounded-xl border bg-white p-4">
        <input type="hidden" name="id" value={id} />
        <DeckEditor
          products={rows}
          companies={companies || []}
          initial={{
            title: deck.title,
            clientName: deck.client_name,
            notes: deck.notes || '',
            companyId: deck.company_id || '',
            showPrices: deck.show_prices !== false,
            slides,
          }}
        />
        <SubmitButton className="mt-4 rounded-lg bg-[#241C12] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
      </ActionForm>

      <DeckView
        title={deck.title}
        clientName={deck.client_name}
        notes={deck.notes || ''}
        showPrices={deck.show_prices !== false}
        organisation={contact.organisation}
        phone={contact.phone}
        items={(items || []).map((item) => ({
          title: item.title,
          imageUrl: item.image_url,
          specs: item.specs || '',
          moq: item.moq,
          kind: item.kind,
          memberNames: item.member_names || [],
          price: Number(item.price),
        }))}
      />
    </div>
  )
}
