import { createClient } from '@/lib/supabase/server'
import { formatCurrency, isUuid, oneRelation } from '@/lib/utils'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { updateProduct, removeProduct } from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { ProductImageEditor } from '@/components/products/product-image-editor'
import { CatalogueVisibilityEditor } from '@/components/products/catalogue-visibility-editor'
import { ChannelBadges } from '@/components/products/channel-badges'
import { channelSummary, hasChannelColumns } from '@/lib/products/channel-visibility'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { CategoryField } from '@/components/products/category-field'
import { readProductCost } from '@/lib/pricing/product-costs'
import { getPricingSettings, loadEffectiveCosts, loadSupplierOffers, resolveListedPrices } from '@/lib/pricing/server'
import { pickBestOffer } from '@/lib/pricing/offers'
import { COST_SOURCES, COST_SOURCE_LABEL } from '@/lib/pricing/cost-basis'
import { PORTAL_LABEL } from '@/lib/pricing/engine'
import { NameCreateField } from '@/components/products/name-create-field'
import { createBrand, createSupplier } from '../actions'
import { SupplierOffersEditor } from './SupplierOffersEditor'
import { purchaseCaption, purchaseOffer } from '@/lib/catalogue/purchase-path'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ removed?: string; image?: string; error?: string }>
}) {
  const profile = await requireStaff(['admin', 'sales', 'management', 'operations'])
  const showCost = canSeeCosts(profile.role)
  const canPrice = ['admin', 'sales', 'management', 'accounts'].includes(profile.role)
  const { id } = await params
  const { removed, image, error } = await searchParams
  if (!isUuid(id)) notFound()
  const supabase = await createClient()

  const [
    { data: product },
    { data: categories },
    { data: brands },
    { data: suppliers },
    { data: allCompanies },
    { data: accessRecords },
    { data: exclusionRecords },
    pricing,
  ] = await Promise.all([
    supabase.from('products').select('*, product_costs(supplier_cost, internal_notes), category:categories(id, name), brand:brands(id, name), supplier:suppliers(id, name)').eq('id', id).maybeSingle(),
    supabase.from('categories').select('id, name'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('companies').select('id, name, logo_path').eq('status', 'active').order('name'),
    supabase.from('company_product_access').select('*, company:companies(id, name, city)').eq('product_id', id),
    // Per-company hide rules. They beat "All companies", so the panel must show them.
    supabase
      .from('company_product_exclusions')
      .select('company_id, created_at, company:companies(id, name, logo_path)')
      .eq('product_id', id)
      .order('created_at', { ascending: false }),
    getPricingSettings(),
  ])
  const offers = canPrice ? await loadSupplierOffers(supabase, [id]) : []
  const best = pickBestOffer(offers, { requireInStock: pricing.requireInStock })

  if (!product) notFound()
  Object.assign(product, readProductCost(product))

  // Store (Retail) price from the shared pricer: fixed price, product margin, or cost + store margin.
  const storeResolved = await resolveListedPrices([{ id }], 'store', null, null, pricing)
  const storePrice = storeResolved?.get(id)?.price ?? null
  const portalCosts = await Promise.all((['store', 'business', 'corporate'] as const).map(async (portal) => ({
    portal,
    basis: (await loadEffectiveCosts(supabase, [id], { requireInStock: pricing.requireInStock, portalDefault: pricing.portals[portal].costSource })).get(id),
  })))
  const costSource = portalCosts[0].basis?.source || 'portal_default'

  const grantedCompanyIds = accessRecords?.map(a => a.company_id) || []
  const channels = channelSummary(product, grantedCompanyIds.length)
  const hiddenFrom = (exclusionRecords || []).map((row) => {
    const company = (Array.isArray(row.company) ? row.company[0] : row.company) as
      | { id: string; name: string; logo_path: string | null }
      | null
    return {
      id: row.company_id as string,
      name: company?.name || 'Unknown company',
      logo_path: company?.logo_path ?? null,
      hiddenAt: row.created_at as string,
    }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/products" label="Back to Products" />

      {removed === 'archived' && (
        <div className="p-3 bg-[#FFB690]/30 text-[#9E4300] text-xs rounded-none border border-[#9E4300]/30">
          This product cannot be permanently deleted because it is used on orders or quotations. It was discontinued instead.
        </div>
      )}
      {error && (
        <div className="p-3 bg-[#FBEDEB] text-[#BA1A1A] text-xs rounded-none border border-[#BA1A1A]/40">{error}</div>
      )}
      {image === 'needed' && !product.image_url && (
        <div className="p-3 bg-[#FFB690]/30 text-[#9E4300] text-xs rounded-none border border-[#9E4300]/30">
          This product was saved without a photo. Upload one below so it displays correctly in the catalogue.
        </div>
      )}
      {image === 'upload-failed' && (
        <div className="p-3 bg-[#FFB690]/30 text-[#9E4300] text-xs rounded-none border border-[#9E4300]/30">
          The product was saved, but the image could not be uploaded. Try again with a JPG, PNG or WebP under 5 MB.
        </div>
      )}

      {/* Product Hero / Summary Panel */}
      <div className="bg-[#FCF9F2] p-6 rounded-none border border-[#CCC5BD] shadow-none">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-4">
          <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
          <span>/</span>
          <Link href="/crm/products" className="hover:text-[#9E4300] transition-colors">Products</Link>
          <span>/</span>
          <span className="text-[#9E4300] font-semibold">{product.sku}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <ProductImageEditor productId={product.id} imageUrl={product.image_url} name={product.name} />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-[#1C1B1A] bg-[#F6F3EC] border border-[#CCC5BD] px-2 py-0.5 rounded-none">
                  {product.sku}
                </span>
                <ChannelBadges summary={channels} />
                {hiddenFrom.length > 0 && (
                  <span
                    title={`Hidden from: ${hiddenFrom.map((c) => c.name).join(', ')}`}
                    className="inline-flex items-center whitespace-nowrap border border-[#9E4300]/30 bg-[#FFB690]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#9E4300] rounded-none"
                  >
                    Hidden from {hiddenFrom.length} {hiddenFrom.length === 1 ? 'company' : 'companies'}
                  </span>
                )}
                {product.status === 'active' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[11px] uppercase text-[#3A4537]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> active
                  </span>
                ) : product.status === 'discontinued' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-none border border-[#BA1A1A]/40 bg-[#FBEDEB] px-2 py-0.5 text-[11px] uppercase text-[#BA1A1A]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> discontinued
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] uppercase text-[#4A4640]">
                    {product.status}
                  </span>
                )}
              </div>

              {profile.role === 'admin' && (
                <div>
                  <ConfirmAction
                    title="Delete product?"
                    confirmLabel="Delete"
                    action={removeProduct}
                    hiddenFields={{ product_id: product.id }}
                    description={
                      <>
                        <p>
                          Product: <span className="font-semibold text-[#1C1B1A]">{product.name}</span>
                        </p>
                        <p>
                          If this product appears on orders, quotations, or sample history it will be discontinued instead of permanently deleted. Images shared with other products are kept.
                        </p>
                      </>
                    }
                  >
                    Delete Product
                  </ConfirmAction>
                </div>
              )}
            </div>

            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              {product.name}
            </h1>
            <p className="text-xs text-[#4A4640] mt-1.5">
              Category: <span className="font-semibold text-[#1C1B1A]">{oneRelation(product.category)?.name || 'General'}</span>
              {product.brand && <> · Brand: <span className="font-semibold text-[#1C1B1A]">{oneRelation(product.brand)?.name}</span></>}
              {product.supplier && <> · Supplier: <span className="font-semibold text-[#1C1B1A]">{oneRelation(product.supplier)?.name}</span></>}
            </p>
          </div>
        </div>

        {/* Dense Key/Value KPI Strip */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 mt-6 pt-5 border-t border-[#CCC5BD]">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Store price</span>
            <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-1 block">{storePrice == null ? 'On quote' : formatCurrency(storePrice)}</span>
            <span className="text-[11px] text-[#7C766F] mt-0.5 block">Resolved store price. Edit prices in Pricing.</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company price</span>
            <span className="text-xs text-[#4A4640] mt-1 block">Set on the Pricing page: company special, then catalog line, then the portal rule</span>
          </div>
          {showCost && (
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Cost price</span>
              <span className="font-mono text-lg font-semibold text-[#4A4640] mt-1 block">{formatCurrency(product.supplier_cost)}</span>
            </div>
          )}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Min Order Qty</span>
            <span className="font-mono text-lg font-semibold text-[#1C1B1A] mt-1 block">{product.moq || 1} units</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Shopper action</span>
            <span className="text-sm font-semibold text-[#1C1B1A] mt-1 block">
              {purchaseCaption(purchaseOffer({
                fulfillmentMode: product.fulfillment_mode,
                stockQty: product.stock_qty,
                hasSellPrice: true,
              }))}
            </span>
            <span className="text-[11px] text-[#7C766F] mt-0.5 block">
              Stock <span className="font-mono">{product.stock_qty ?? 0}</span> · {product.fulfillment_mode || 'auto'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
            <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">
              Edit Product Information
            </h2>
          </div>

          <ActionForm action={updateProduct.bind(null, product.id)} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Product Name</label>
              <input
                type="text"
                name="name"
                defaultValue={product.name}
                required
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">SKU</label>
                <input
                  type="text"
                  name="sku"
                  defaultValue={product.sku}
                  required
                  className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs uppercase text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                />
                <p className="text-[11px] text-[#7C766F] mt-1">Permanent identifier. Admin-only to change; changes are audited.</p>
              </div>

              <MobileSheetSelect
                name="status"
                label="Status"
                showDesktopLabel
                defaultValue={product.status}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                  { value: 'discontinued', label: 'Discontinued' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                {showCost ? (
                  <>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Cost price (&#8377;) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="supplier_cost"
                      defaultValue={product.supplier_cost ?? ''}
                      required
                      className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                    />
                    <p className="mt-1 text-[11px] text-[#7C766F]">
                      What you pay the supplier per unit. Selling prices are set in{' '}
                      <Link href="/crm/pricing" className="font-semibold text-[#9E4300] underline underline-offset-2 hover:text-[#1C1B1A]">
                        Pricing
                      </Link>
                      . Fixed prices and margins per portal live there.
                    </p>
                    <label className="mt-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Cost source</label>
                    <select
                      name="cost_source"
                      defaultValue={costSource}
                      className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                    >
                      {COST_SOURCES.map((source) => <option key={source} value={source}>{COST_SOURCE_LABEL[source]}</option>)}
                    </select>
                    <p className="mt-1 text-[11px] text-[#7C766F]">
                      Prices are built from the effective cost on each portal:{' '}
                      {portalCosts.map(({ portal, basis }, index) => (
                        <span key={portal}>
                          {index ? ' · ' : ''}{PORTAL_LABEL[portal]} <span className="font-mono">{basis?.cost == null ? 'no cost' : formatCurrency(basis.cost)}</span> ({COST_SOURCE_LABEL[basis?.basis || 'manual'].toLowerCase()}{basis?.from === 'manual' && basis.basis !== 'manual' ? ', no eligible offer' : ''})
                        </span>
                      ))}
                    </p>
                  </>
                ) : (
                  <>
                    <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Price</span>
                    <p className="text-[11px] text-[#7C766F]">
                      Prices come from the cost price, which admin or accounts set. Selling prices are set in{' '}
                      <Link href="/crm/pricing" className="font-semibold text-[#9E4300] underline underline-offset-2 hover:text-[#1C1B1A]">
                        Pricing
                      </Link>
                      .
                    </p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">MOQ</label>
                <input
                  type="number"
                  name="moq"
                  defaultValue={product.moq || 1}
                  required
                  className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Stock on hand</label>
                <input
                  type="number"
                  name="stock_qty"
                  min="0"
                  step="1"
                  defaultValue={product.stock_qty ?? 0}
                  className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                />
              </div>
            </div>

            <MobileSheetSelect
              name="fulfillment_mode"
              label="Purchase path"
              showDesktopLabel
              defaultValue={product.fulfillment_mode || 'auto'}
              options={[
                { value: 'auto', label: 'Auto — stock decides' },
                { value: 'buy', label: 'Buy — immediate purchase' },
                { value: 'rfq', label: 'Request quote' },
              ]}
            />
            <p className="text-[11px] text-[#7C766F]">
              Auto with stock shows Add to cart up to that quantity, and Request quote for a larger run. Auto with zero stock shows Request quote.
              Buy with zero stock shows Add to cart for any quantity. Request quote hides Add to cart. Catalog kits stay on Request quote.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <CategoryField categories={categories || []} defaultValue={product.category_id || ''} />

              <NameCreateField
                name="brand_id"
                label="Brand"
                options={brands || []}
                defaultValue={product.brand_id || ''}
                emptyLabel="Select Brand"
                placeholder="New brand name"
                create={createBrand}
              />
            </div>

            <NameCreateField
              name="supplier_id"
              label="Supplier"
              options={suppliers || []}
              defaultValue={product.supplier_id || ''}
              emptyLabel="No supplier"
              placeholder="New supplier name"
              create={createSupplier}
            />
            <input type="hidden" name="sample_only_present" value="1" />
            <label className="flex items-center gap-2 text-xs text-[#4A4640] cursor-pointer">
              <input type="checkbox" name="sample_only" value="on" defaultChecked={Boolean(product.sample_only)} className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0" />
              Sample only. Kept in the staff sample register, off the retail store, business portal, and client catalogues.
            </label>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Add to office samples</label>
              <input
                type="number"
                name="initial_sample_qty"
                min="0"
                step="1"
                placeholder="Blank leaves the current count"
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
              <p className="mt-1 text-[11px] text-[#7C766F]">
                Ticking Sample only lists the product under Samples. Enter a quantity only when pieces are being received into the office.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">Description</label>
              <textarea
                name="description"
                rows={3}
                defaultValue={product.description || ''}
                className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
              />
            </div>

            <SubmitButton
              className="w-full py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] bg-[#1C1B1A] hover:bg-[#9E4300] rounded-none transition-colors"
              pendingLabel="Saving…">
              Save Product Details
            </SubmitButton>
          </ActionForm>
        </div>

        {profile.role === 'admin' ? (
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6">
          <CatalogueVisibilityEditor
            productId={product.id}
            initialMode={product.catalogue_access || 'all'}
            initialStore={channels.store}
            initialBusiness={channels.business}
            channelsReady={hasChannelColumns(product)}
            companies={allCompanies || []}
            grantedIds={grantedCompanyIds}
            hiddenFrom={hiddenFrom}
          />
        </div>
        ) : (
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-3">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
            <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Where this product shows</h2>
          </div>
          <ChannelBadges summary={channels} />
          {hiddenFrom.length > 0 && (
            <p className="text-xs text-[#9E4300]">
              Hidden from these companies: {hiddenFrom.map((c) => c.name).join(' · ')}
            </p>
          )}
          <p className="text-xs text-[#7C766F]">Only admin can change where this product shows.</p>
        </div>
        )}
      </div>

      {canPrice && (
        <SupplierOffersEditor
          productId={product.id}
          suppliers={(suppliers || []).map((supplier) => ({ id: supplier.id, name: supplier.name }))}
          offers={offers}
          bestOfferId={best?.id || null}
        />
      )}
    </div>
  )
}
