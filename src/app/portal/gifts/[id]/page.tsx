import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, isUuid } from '@/lib/utils'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogueShortlistButton } from '@/components/portal/catalogue-shortlist-button'
import { offeringPricesForCompany } from '@/lib/catalogs/pricing'
import { headers } from 'next/headers'
import { readTenantFromHeaders } from '@/lib/portal-host'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleOfferingSelectionForm } from '@/app/portal/catalogue/actions'
import { budgetBadge } from '@/lib/portal/catalog-quote'
import { kitDisplayTotal } from '@/lib/catalogs/visibility'
import { displayableLineIds } from '@/lib/catalogs/visibility-data'

export default async function GiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const withPurchase = 'id, name, sku, description, image_url, price, moq, category_name, brand_name, stock_qty, fulfillment_mode'
  const withoutPurchase = 'id, name, sku, description, image_url, price, moq, category_name, brand_name'
  let productResult = await supabase.from('client_products').select(withPurchase).eq('id', id).maybeSingle()
  if (productResult.error && /stock_qty|fulfillment_mode/i.test(productResult.error.message)) {
    productResult = await supabase.from('client_products').select(withoutPurchase).eq('id', id).maybeSingle()
  }
  const product = productResult.data

  if (product) {
    const tenant = readTenantFromHeaders(await headers())
    if (tenant) {
      const { data: companyId } = await supabase.rpc('client_company_id')
      const companyMargin = companyId ? await getCompanyMarginPercent(companyId) : null
      const micrositePrices = await sellPricesForSurface([product.id], 'microsite', companyMargin)
      if (micrositePrices?.has(product.id)) product.price = micrositePrices.get(product.id) ?? null
    }

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <BackButton href="/portal/gifts" label="Back to gifts" className="min-h-10" />
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <ProductImage src={product.image_url} alt={product.name} size="hero" className="h-72 border-b border-gray-100 md:h-full md:border-b-0 md:border-r" />
            <div className="space-y-4 p-5 sm:p-6">
              {product.category_name ? (
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)]">{product.category_name}</p>
              ) : null}
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              {product.brand_name ? <p className="text-xs text-gray-500">by {product.brand_name}</p> : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                {product.description || 'Ask your account manager for samples and branding options.'}
              </p>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xl font-semibold text-gray-900">{product.price == null ? 'Price on request' : formatCurrency(product.price)}</p>
                <p className="mt-0.5 text-xs text-gray-400">Per person · MOQ {product.moq || 1}</p>
              </div>
              <CatalogueShortlistButton
                variant="detail"
                product={{
                  id: product.id,
                  sku: product.sku,
                  name: product.name,
                  price: product.price,
                  image_url: product.image_url,
                  category_name: product.category_name,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { data: offering } = await supabase
    .from('campaign_products')
    .select('id, display_name, client_description, client_image_url, selling_price, pack_kit_total, moq, pack_kit_id, pack_kit_role, campaign_id, personalization_options, estimated_delivery, campaign:campaigns(id, name, budget_per_employee), product:products!inner(status)')
    .eq('id', id)
    .eq('visibility', 'published')
    .eq('product.status', 'active')
    .maybeSingle()

  if (!offering) notFound()

  const { data: companyId } = await supabase.rpc('client_company_id')
  const visibleIds = companyId
    ? await displayableLineIds(offering.campaign_id, { kind: 'company', companyId })
    : null
  if (visibleIds && !visibleIds.has(offering.id)) notFound()

  let kitMembers: { id: string; display_name: string | null; selling_price: number | null }[] = []
  if (offering.pack_kit_id && offering.pack_kit_role === 'primary') {
    const { data: lines } = await supabase
      .from('campaign_products')
      .select('id, display_name, selling_price, display_order')
      .eq('pack_kit_id', offering.pack_kit_id)
      .eq('visibility', 'published')
      .order('display_order')
    kitMembers = lines || []
  }
  if (visibleIds) kitMembers = kitMembers.filter((member) => visibleIds.has(member.id))
  const prices = await offeringPricesForCompany([offering.id, ...kitMembers.map((member) => member.id)], companyId)
  kitMembers = kitMembers.map((member) => ({ ...member, selling_price: prices.get(member.id) ?? member.selling_price }))
  const pricedOffering = prices.get(offering.id) ?? offering.selling_price
  const kitTotal = kitMembers.length
    ? (kitDisplayTotal(kitMembers) ?? pricedOffering)
    : pricedOffering
  const price = kitTotal == null || !Number.isFinite(Number(kitTotal)) ? null : Number(kitTotal)
  const campaign = Array.isArray(offering.campaign) ? offering.campaign[0] : offering.campaign
  const { data: selection } = await supabase
    .from('client_product_selections')
    .select('kind')
    .eq('campaign_product_id', offering.id)
    .eq('user_id', user.id)
    .maybeSingle()
  const saved = selection?.kind === 'shortlisted' || selection?.kind === 'selected'
  const badge = budgetBadge(price, campaign?.budget_per_employee == null ? null : Number(campaign.budget_per_employee))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackButton href={`/portal/gifts/collection/${offering.campaign_id}`} label="Back to collection" className="min-h-10" />
      <div className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8 md:grid-cols-2 md:gap-8">
        <ProductImage src={offering.client_image_url} alt={offering.display_name || 'Gift'} size="hero" className="min-h-[240px] rounded-xl border border-gray-100 sm:min-h-[300px]" />
        <div className="flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase text-[#806A50]">{campaign?.name}</p>
            <h1 className="text-2xl font-bold text-gray-900">{offering.display_name}</h1>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-3xl font-bold text-gray-900">{price == null ? 'Price on request' : formatCurrency(price)}</p>
              <p className="mt-1 text-xs text-gray-500">
                {kitMembers.length > 1 ? 'Combined price per person' : `Per person · MOQ ${offering.moq || 1}`}
              </p>
              {badge ? (
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge === 'within' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                  {badge === 'within' ? 'Within budget' : 'Over budget'}
                </span>
              ) : null}
            </div>
            {kitMembers.length > 1 && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-800">Included gifts</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  {kitMembers.map((line) => (
                    <li key={line.id} className="flex justify-between gap-2">
                      <span>{line.display_name}</span>
                      <span className="font-medium">{formatCurrency(line.selling_price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm leading-relaxed text-gray-600">
              {offering.client_description || 'Corporate gift with branding options.'}
            </p>
            {offering.personalization_options ? (
              <p className="text-xs text-gray-500">Personalization: {offering.personalization_options}</p>
            ) : null}
            {offering.estimated_delivery ? (
              <p className="text-xs text-gray-500">Estimated delivery: {offering.estimated_delivery}</p>
            ) : null}
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <Link
              href={`/portal/gifts/collection/${offering.campaign_id}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#806A50] px-4 text-sm font-semibold text-white hover:bg-[#9C8567]"
            >
              Open collection
            </Link>
            <ActionForm action={toggleOfferingSelectionForm} successMessage="Saved">
              <input type="hidden" name="campaign_id" value={offering.campaign_id} />
              <input type="hidden" name="campaign_product_id" value={offering.id} />
              <input type="hidden" name="kind" value="shortlisted" />
              {saved ? <input type="hidden" name="remove" value="1" /> : null}
              <SubmitButton
                pendingLabel="Saving…"
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#806A50]"
              >
                {saved ? 'Remove from quote basket' : 'Save to quote basket'}
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      </div>
    </div>
  )
}
