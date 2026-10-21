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
import { getCompanyMarginPercent, getPricingSettings, sellPricesForSurface } from '@/lib/pricing/server'
import { gstPriceNote } from '@/lib/pricing/engine'
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
  const gstNote = gstPriceNote((await getPricingSettings()).portals.corporate.gstMode)

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
      const micrositePrices = await sellPricesForSurface([product.id], 'microsite', companyMargin, companyId)
      if (micrositePrices?.has(product.id)) product.price = micrositePrices.get(product.id) ?? null
    }

    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <BackButton href="/portal/gifts" label="Back to gifts" className="min-h-10 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] hover:text-[#1C1B1A]" />
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="relative aspect-square md:aspect-auto overflow-hidden bg-[#F1EEE7] border-b md:border-b-0 md:border-r border-[#CCC5BD]">
              <ProductImage
                src={product.image_url}
                alt={product.name}
                size="hero"
                className="h-full w-full object-cover rounded-none"
              />
            </div>
            <div className="flex flex-col justify-between p-6 sm:p-8 space-y-6">
              <div className="space-y-4">
                {product.category_name ? (
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                    {product.category_name}
                  </p>
                ) : null}
                <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1C1B1A] tracking-tight leading-tight">
                  {product.name}
                </h1>
                {product.brand_name ? (
                  <p className="text-xs text-[#7C766F]">by {product.brand_name}</p>
                ) : null}

                {/* Mono price block */}
                <div className="border-y border-[#CCC5BD] py-4">
                  <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1C18]">
                    {product.price == null ? 'Price on request' : formatCurrency(product.price)}
                    {product.price != null ? <span className="ml-2 font-sans text-[10px] font-medium uppercase tracking-wide text-[#7C766F]">{gstNote}</span> : null}
                  </p>
                  <p className="font-mono text-xs text-[#7C766F] mt-1">
                    Per unit · MOQ {product.moq || 1}
                  </p>
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4A4640]">
                  {product.description || 'Ask your account manager for samples and branding options.'}
                </p>

                {/* Hairline spec rows */}
                <div className="divide-y divide-[#CCC5BD] border-y border-[#CCC5BD] text-xs">
                  {product.sku ? (
                    <div className="flex justify-between py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">SKU</span>
                      <span className="font-mono text-[#1C1B1A]">{product.sku}</span>
                    </div>
                  ) : null}
                  {product.category_name ? (
                    <div className="flex justify-between py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Category</span>
                      <span className="text-[#1C1B1A]">{product.category_name}</span>
                    </div>
                  ) : null}
                  {product.brand_name ? (
                    <div className="flex justify-between py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Brand</span>
                      <span className="text-[#1C1B1A]">{product.brand_name}</span>
                    </div>
                  ) : null}
                  {'stock_qty' in product && product.stock_qty != null ? (
                    <div className="flex justify-between py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Stock</span>
                      <span className="font-mono text-[#1C1B1A]">{Number(product.stock_qty)} units</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="pt-2">
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
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton
        href={`/portal/gifts/collection/${offering.campaign_id}`}
        label="Back to catalog"
        className="min-h-10 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] hover:text-[#1C1B1A]"
      />
      <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="relative aspect-square md:aspect-auto overflow-hidden bg-[#F1EEE7] border-b md:border-b-0 md:border-r border-[#CCC5BD]">
            <ProductImage
              src={offering.client_image_url}
              alt={offering.display_name || 'Gift'}
              size="hero"
              className="h-full w-full object-cover rounded-none"
            />
          </div>
          <div className="flex flex-col justify-between p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              {campaign?.name ? (
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">
                  {campaign.name}
                </p>
              ) : null}
              <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#1C1B1A] tracking-tight leading-tight">
                {offering.display_name}
              </h1>

              {/* Mono price block */}
              <div className="border-y border-[#CCC5BD] py-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#1C1C18]">
                      {price == null ? 'Price on request' : formatCurrency(price)}
                      {price != null ? <span className="ml-2 font-sans text-[10px] font-medium uppercase tracking-wide text-[#7C766F]">{gstNote}</span> : null}
                    </p>
                    <p className="font-mono text-xs text-[#7C766F] mt-1">
                      {kitMembers.length > 1 ? 'Combined price per person' : `Per person · MOQ ${offering.moq || 1}`}
                    </p>
                  </div>
                  {badge ? (
                    <span className={`inline-flex rounded-none px-2.5 py-0.5  text-[11px] uppercase tracking-wider border ${
                      badge === 'within'
                        ? 'border-[#3A4537]/30 bg-[#DAE6D3] text-[#3A4537]'
                        : 'border-[#BA1A1A]/30 bg-[#FFDAD6] text-[#BA1A1A]'
                    }`}>
                      {badge === 'within' ? 'Within budget' : 'Over budget'}
                    </span>
                  ) : null}
                </div>
              </div>

              {kitMembers.length > 1 && (
                <div className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-2">Included gifts</p>
                  <ul className="divide-y divide-[#CCC5BD] text-xs text-[#1C1C18]">
                    {kitMembers.map((line) => (
                      <li key={line.id} className="flex justify-between py-1.5 gap-2">
                        <span>{line.display_name}</span>
                        <span className="font-mono font-medium">{formatCurrency(line.selling_price)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4A4640]">
                {offering.client_description || 'Corporate gift with branding options.'}
              </p>

              {/* Hairline spec rows */}
              <div className="divide-y divide-[#CCC5BD] border-y border-[#CCC5BD] text-xs">
                {offering.personalization_options ? (
                  <div className="flex justify-between py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Personalization</span>
                    <span className="text-[#1C1B1A]">{offering.personalization_options}</span>
                  </div>
                ) : null}
                {offering.estimated_delivery ? (
                  <div className="flex justify-between py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Estimated Delivery</span>
                    <span className="font-mono text-[#1C1B1A]">{offering.estimated_delivery}</span>
                  </div>
                ) : null}
                {campaign?.budget_per_employee != null ? (
                  <div className="flex justify-between py-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Per-person Budget</span>
                    <span className="font-mono text-[#1C1B1A]">{formatCurrency(campaign.budget_per_employee)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-[#CCC5BD]">
              <Link
                href={`/portal/gifts/collection/${offering.campaign_id}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#9E4300] transition-colors"
              >
                Open catalog
              </Link>
              <ActionForm action={toggleOfferingSelectionForm} successMessage="Saved">
                <input type="hidden" name="campaign_id" value={offering.campaign_id} />
                <input type="hidden" name="campaign_product_id" value={offering.id} />
                <input type="hidden" name="kind" value="shortlisted" />
                {saved ? <input type="hidden" name="remove" value="1" /> : null}
                <SubmitButton
                  pendingLabel="Saving…"
                  className={`inline-flex min-h-10 w-full items-center justify-center rounded-none px-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
                    saved
                      ? 'border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                      : 'border border-[#CCC5BD] bg-[#FCF9F2] text-[#1C1C18] hover:bg-[#F6F3EC]'
                  }`}
                >
                  {saved ? 'Remove from quote basket' : 'Save to quote basket'}
                </SubmitButton>
              </ActionForm>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
