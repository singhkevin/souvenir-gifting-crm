import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCurrency, isUuid } from '@/lib/utils'
import { addCampaignProduct, setCampaignProductVisibility, removeCampaignProduct, updateCampaign, removeCampaign } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { BackButton } from '@/components/ui/back-button'
import { asFormAction } from '@/lib/form-action'
import { requireStaff } from '@/lib/auth'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ removed?: string }>
}) {
  const { id } = await params
  const { removed } = await searchParams
  if (!isUuid(id)) notFound()
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()

  const [{ data: campaign }, { data: offerings }, { data: products }, { data: selections }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(id, name)').eq('id', id).maybeSingle(),
    supabase.from('campaign_products').select('*, product:products(id, name, sku, price, status)').eq('campaign_id', id).order('display_order'),
    supabase.from('products').select('id, name, sku, price').eq('status', 'active').order('name').limit(200),
    supabase.from('client_product_selections').select('*, selector:profiles!user_id(full_name, email), offering:campaign_products(display_name)').eq('campaign_id', id).order('created_at', { ascending: false }),
  ])

  if (!campaign) notFound()
  const company = Array.isArray(campaign.company) ? campaign.company[0] : campaign.company
  const offeredIds = new Set((offerings || []).map((o) => o.product_id))
  const available = (products || []).filter((p) => !offeredIds.has(p.id))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton href="/crm/campaigns" label="Back to campaigns" />
      {removed === 'archived' && (
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          This campaign cannot be permanently deleted because it has existing orders. It was closed instead.
        </div>
      )}
      <div>
        <h1 className="font-serif text-2xl">{campaign.name}</h1>
        <p className="text-xs text-[#7A7267] mt-1">
          {company?.name} · {campaign.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(campaign.budget_per_employee)} / person · {formatCurrency(campaign.total_budget)} total
        </p>
        <p className="text-xs mt-1">Status: {campaign.status} · Client catalogue: {campaign.published_to_client_at ? 'published' : 'not published'}</p>
        <div className="mt-3">
          <ConfirmAction
            title="Remove campaign?"
            confirmLabel="Delete"
            action={asFormAction(removeCampaign)}
            hiddenFields={{ id: campaign.id }}
            description={<p>Campaign: <span className="font-semibold">{campaign.name}</span>. If it has orders it will be closed instead of deleted.</p>}
          >
            Delete campaign
          </ConfirmAction>
        </div>
      </div>

      <form action={asFormAction(updateCampaign)} className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-3 text-xs">
        <input type="hidden" name="id" value={campaign.id} />
        <input name="name" required defaultValue={campaign.name} className="border rounded-lg px-3 py-2" />
        <input name="occasion" defaultValue={campaign.occasion || ''} placeholder="Occasion" className="border rounded-lg px-3 py-2" />
        <input name="employee_quantity" type="number" min="1" defaultValue={campaign.employee_quantity || 1} className="border rounded-lg px-3 py-2" />
        <input name="budget_per_employee" type="number" step="0.01" min="0" defaultValue={campaign.budget_per_employee || 0} className="border rounded-lg px-3 py-2" />
        <SheetDateField name="required_delivery_date" label="Required delivery" defaultValue={campaign.required_delivery_date || ''} />
        <input name="description" defaultValue={campaign.description || ''} placeholder="Notes" className="min-h-11 rounded-lg border px-3 py-2" />
        <button className="min-h-11 rounded-lg bg-[#1A3022] font-semibold text-white">Save campaign</button>
      </form>

      <form action={asFormAction(addCampaignProduct)} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3">
        <input type="hidden" name="campaign_id" value={campaign.id} />
        <MobileSheetSelect
          name="product_id"
          label="Product"
          required
          emptyLabel="Add from internal catalogue"
          className="md:col-span-2"
          options={[
            { value: '', label: 'Add from internal catalogue' },
            ...available.map((p) => ({
              value: p.id,
              label: `${p.name} · ${formatCurrency(p.price)}`,
            })),
          ]}
        />
        <input name="selling_price" type="number" step="0.01" placeholder="Client selling price" className="border rounded-lg px-2 py-2" />
        <button className="bg-[#1A3022] text-white rounded-lg font-semibold">Add as draft offering</button>
      </form>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[#FAF7F2] text-left">
            <tr>
              <th className="p-3">Client offering</th>
              <th className="p-3">Client price</th>
              <th className="p-3">Visibility</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(offerings || []).map((row) => {
              const product = Array.isArray(row.product) ? row.product[0] : row.product
              const discontinued = product?.status && product.status !== 'active'
              return (
                <tr key={row.id} className="border-t">
                  <td className="p-3">
                    <p className="font-semibold">{row.display_name || product?.name}</p>
                    <p className="text-[#7A7267]">{product?.sku} · internal {formatCurrency(product?.price)}</p>
                    {discontinued ? (
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                        Master product discontinued — unpublish or replace
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3">{formatCurrency(row.selling_price)}</td>
                  <td className="p-3 capitalize">{row.visibility}</td>
                  <td className="p-3 space-x-2">
                    {row.visibility !== 'published' ? (
                      discontinued ? (
                        <span className="text-[#7A7267]">Cannot publish</span>
                      ) : (
                        <form action={asFormAction(setCampaignProductVisibility)} className="inline">
                          <input type="hidden" name="campaign_id" value={campaign.id} />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="visibility" value="published" />
                          <button className="underline text-[#1A3022]">Publish to client</button>
                        </form>
                      )
                    ) : (
                      <form action={asFormAction(setCampaignProductVisibility)} className="inline">
                        <input type="hidden" name="campaign_id" value={campaign.id} />
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="visibility" value="unpublished" />
                        <button className="underline">Unpublish</button>
                      </form>
                    )}
                    <form action={asFormAction(removeCampaignProduct)} className="inline">
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="id" value={row.id} />
                      <button className="underline text-red-700">Remove</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-2xl p-5">
        <h2 className="font-serif text-lg mb-3">Client selections</h2>
        {(selections || []).length === 0 && <p className="text-sm text-gray-500">No client selections yet.</p>}
        {(selections || []).map((s) => {
          const person = Array.isArray(s.selector) ? s.selector[0] : s.selector
          const offering = Array.isArray(s.offering) ? s.offering[0] : s.offering
          return (
            <p key={s.id} className="text-sm py-1 border-t">
              {person?.full_name || person?.email || 'Client'} · {offering?.display_name || 'Product'} · {s.kind} · qty {s.quantity} {s.comment ? `· ${s.comment}` : ''}
            </p>
          )
        })}
      </div>
    </div>
  )
}
