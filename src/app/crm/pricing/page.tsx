import Link from 'next/link'
import { requireStaff, canEditPricing } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { ClientTabs } from '@/components/ui/client-tabs'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { formatDateTime, isUuid } from '@/lib/utils'
import { gstPriceNote, PORTAL_LABEL } from '@/lib/pricing/engine'
import { saveCompanySpecialPrice, removeCompanySpecialPrice } from '@/app/crm/companies/special-price-actions'
import { savePricingCompanyMargin, setCatalogManualPrice } from './actions'
import { loadPricingPage } from './load'
import { PortalRules } from './portal-rules'
import { PriceGrid } from './price-grid'
import { COST_SOURCE_LABEL } from '@/lib/pricing/cost-basis'
import { ProductThumb } from '@/components/ui/product-thumb'

export const dynamic = 'force-dynamic'

const TABS = ['Portal rules', 'Price grid', 'Company prices', 'Change log']

function amount(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; company?: string; product?: string }>
}) {
  const profile = await requireStaff(['admin', 'accounts', 'management', 'sales'])
  const params = await searchParams
  const canEdit = canEditPricing(profile.role)
  const companyId = isUuid(params.company || '') ? params.company || null : null
  const productId = isUuid(params.product || '') ? params.product || null : null
  const data = await loadPricingPage(profile, companyId, productId)
  const initialTab = TABS.includes(params.tab || '') ? params.tab || TABS[0] : TABS[0]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pricing"
        description="One cost price, and one price per portal. Quotes and orders keep the price they were given."
      />
      {data.migrationRequired ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Apply supabase/migrations/20261021_pricing_engine.sql before saving. Until then, this page shows the current rule prices and cannot store fixed prices.
        </p>
      ) : null}
      {data.productError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{data.productError}</p>
      ) : null}
      <p className="text-xs text-gray-500">
        Store prices are labelled {gstPriceNote(data.settings.portals.store.gstMode)}. Business prices are labelled {gstPriceNote(data.settings.portals.business.gstMode)}. Corporate prices are labelled {gstPriceNote(data.settings.portals.corporate.gstMode)}.
        {' '}The label does not add GST to a direct purchase. Quotations still add their own tax percent.
      </p>

      {data.drill ? (
        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <ProductThumb src={data.drill.product.imageUrl} alt={data.drill.product.name} />
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Where is this price? {data.drill.product.name}</h2>
                <p className="font-mono text-[11px] text-gray-400">{data.drill.product.sku}</p>
              </div>
            </div>
            <Link href="/crm/pricing?tab=Price%20grid" className="text-xs text-[#806A50] underline">Close</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['store', 'business', 'corporate'] as const).map((portal) => {
              const cell = data.drill?.product[portal]
              if (!cell) return null
              return (
                <div key={portal} className="rounded-lg border border-gray-100 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-gray-400">{PORTAL_LABEL[portal]} · no company</p>
                  <p className="text-sm font-semibold text-gray-900">{cell.price == null ? 'Price on quote' : amount(cell.price)}</p>
                  <p className="text-[11px] text-gray-500">{cell.source}{data.showCost && cell.marginOverCost != null ? ` · ${cell.marginOverCost}% over cost` : ''}</p>
                  {data.showCost && cell.belowFloor ? <p className="text-[11px] text-amber-800">Below the minimum margin</p> : null}
                </div>
              )
            })}
          </div>
          {data.showCost ? <p className="text-xs text-gray-500">Cost price {amount(data.drill.product.cost)} · {COST_SOURCE_LABEL[data.drill.product.costSource]}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-medium">Company</th>
                  <th className="py-2 pr-3 font-medium">Margin</th>
                  <th className="py-2 pr-3 font-medium">Special</th>
                  <th className="py-2 pr-3 font-medium">Business</th>
                  <th className="py-2 font-medium">Corporate</th>
                </tr>
              </thead>
              <tbody>
                {data.drill.companies.length === 0 ? <tr><td colSpan={5} className="py-3 text-gray-500">No company margin or special price for this product.</td></tr> : null}
                {data.drill.companies.map((company) => (
                  <tr key={company.id} className="border-t border-gray-100">
                    <td className="py-2 pr-3">{company.name}</td>
                    <td className="py-2 pr-3">{company.margin == null ? '—' : `${company.margin}%`}</td>
                    <td className="py-2 pr-3">{company.special == null ? '—' : `${amount(company.special)}${company.specialUntil ? ` until ${company.specialUntil}` : ''}`}</td>
                    <td className="py-2 pr-3">{company.business.price == null ? 'Price on quote' : amount(company.business.price)} <span className="text-gray-400">{company.business.source}</span></td>
                    <td className="py-2">{company.corporate.price == null ? 'Price on quote' : amount(company.corporate.price)} <span className="text-gray-400">{company.corporate.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.drill.catalogs.length > 0 ? (
            <ul className="space-y-1 text-xs text-gray-600">
              {data.drill.catalogs.map((line) => (
                <li key={`${line.campaign}-${line.manualPrice}`}>{line.campaign}: catalog fixed {amount(line.manualPrice)} · stored line {amount(line.sellingPrice)}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <ClientTabs
        tabs={TABS}
        initialTab={initialTab}
        panels={{
          'Portal rules': (
            <PortalRules
              rules={data.settings.portals}
              samples={data.samples}
              showCost={data.showCost}
              canEdit={canEdit}
              micrositeHiddenSeparately={data.micrositeHiddenSeparately}
            />
          ),
          'Price grid': (
            <PriceGrid
              rows={data.rows}
              canEdit={canEdit}
              showCost={data.showCost}
              floors={{
                store: data.settings.portals.store.minMarginPercent,
                business: data.settings.portals.business.minMarginPercent,
                corporate: data.settings.portals.corporate.minMarginPercent,
              }}
            />
          ),
          'Company prices': (
            <div className="space-y-4">
              <form className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4" action="/crm/pricing">
                <input type="hidden" name="tab" value="Company prices" />
                <label className="text-xs text-gray-500">
                  Company
                  <select name="company" defaultValue={data.selected?.id || ''} className="mt-1 block min-w-60 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Choose a company</option>
                    {data.companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="rounded-lg bg-[#806A50] px-3 py-2 text-sm font-medium text-white">Show</button>
              </form>
              {data.selected ? (
                <>
                  <section className="rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-gray-900">{data.selected.name}</h2>
                    <p className="mt-1 text-xs text-gray-500">
                      {data.selected.accountType || 'Company'} · margin {data.selected.margin == null ? 'not set, so the portal margin is used' : `${data.selected.margin}%`}
                    </p>
                    {canEdit ? (
                      <ActionForm action={savePricingCompanyMargin} className="mt-3 flex items-end gap-2">
                        <input type="hidden" name="company_id" value={data.selected.id} />
                        <label className="text-xs text-gray-500">
                          Company margin %
                          <input name="margin_percent" type="number" min="0" step="0.01" defaultValue={data.selected.margin ?? ''} className="mt-1 block w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </label>
                        <SubmitButton className="rounded-lg border border-[#806A50] px-3 py-2 text-sm text-[#806A50]" pendingLabel="Saving…">Save margin</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </section>
                  <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-gray-900">Special prices</h2>
                    <table className="mt-3 w-full min-w-[640px] text-xs">
                      <thead className="text-left text-gray-500">
                        <tr><th className="py-2 pr-3">Product</th><th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Until</th><th className="py-2" /></tr>
                      </thead>
                      <tbody>
                        {data.specials.length === 0 ? <tr><td colSpan={4} className="py-3 text-gray-500">No special prices.</td></tr> : null}
                        {data.specials.map((row) => (
                          <tr key={row.productId} className="border-t border-gray-100">
                            <td className="py-2 pr-3"><div className="flex items-center gap-2"><ProductThumb src={row.imageUrl} alt={row.name} /><span>{row.name} <span className="font-mono text-[10px] text-gray-400">{row.sku}</span></span></div></td>
                            <td className="py-2 pr-3">
                              {amount(row.price)}
                              {row.portal ? <span className="block text-[10px] text-gray-500">{row.portal === 'corporate' ? 'Corporate only' : 'Business only'}</span> : null}
                              {row.migrated ? <span className="block text-[10px] text-gray-500">Migrated from retail</span> : null}
                            </td>
                            <td className="py-2 pr-3">{row.validUntil || 'No end date'}</td>
                            <td className="py-2">
                              {canEdit ? (
                                <ActionForm action={removeCompanySpecialPrice}>
                                  <input type="hidden" name="company_id" value={data.selected?.id} />
                                  <input type="hidden" name="product_id" value={row.productId} />
                                  <button type="submit" className="text-red-700 underline">Remove</button>
                                </ActionForm>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {canEdit && data.selected ? (
                      <ActionForm action={saveCompanySpecialPrice} className="mt-4 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="company_id" value={data.selected.id} />
                        <label className="text-xs text-gray-500">
                          Product
                          <select name="product_id" className="mt-1 block max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm" required>
                            <option value="">Choose</option>
                            {data.rows.map((row) => <option key={row.id} value={row.id}>{row.name} ({row.sku})</option>)}
                          </select>
                        </label>
                        <label className="text-xs text-gray-500">
                          Price
                          <input name="price" type="number" min="0" step="0.01" required className="mt-1 block w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </label>
                        <label className="text-xs text-gray-500">
                          Valid until
                          <input name="valid_until" type="date" className="mt-1 block rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                        </label>
                        <SubmitButton className="rounded-lg bg-[#806A50] px-3 py-2 text-sm font-medium text-white" pendingLabel="Saving…">Add special</SubmitButton>
                      </ActionForm>
                    ) : null}
                  </section>
                  <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white p-4">
                    <h2 className="text-sm font-semibold text-gray-900">Catalog fixed prices</h2>
                    <table className="mt-3 w-full min-w-[640px] text-xs">
                      <thead className="text-left text-gray-500"><tr><th className="py-2 pr-3">Catalog</th><th className="py-2 pr-3">Product</th><th className="py-2">Fixed price</th></tr></thead>
                      <tbody>
                        {data.catalogFixed.length === 0 ? <tr><td colSpan={3} className="py-3 text-gray-500">No catalog line has a fixed price for this company.</td></tr> : null}
                        {data.catalogFixed.map((line) => (
                          <tr key={line.id} className="border-t border-gray-100">
                            <td className="py-2 pr-3">{line.campaign}</td>
                            <td className="py-2 pr-3"><div className="flex items-center gap-2"><ProductThumb src={line.imageUrl} alt={line.name} /><span>{line.name}</span></div></td>
                            <td className="py-2">
                              {canEdit ? (
                                <ActionForm action={setCatalogManualPrice} className="flex items-center gap-2">
                                  <input type="hidden" name="line_id" value={line.id} />
                                  <input name="price" type="number" min="0" step="0.01" defaultValue={line.manualPrice ?? ''} className="w-28 rounded border border-gray-200 px-2 py-1" />
                                  <button type="submit" className="text-[#806A50]">Save</button>
                                  <button type="submit" name="clear" value="1" className="text-gray-500 underline">Clear</button>
                                </ActionForm>
                              ) : amount(line.manualPrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                </>
              ) : <p className="text-sm text-gray-500">Choose a company to see its margin, special prices, and catalog fixed prices.</p>}
            </div>
          ),
          'Change log': (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              {data.logMissing ? (
                <p className="p-4 text-sm text-gray-500">Apply supabase/migrations/20261021_pricing_engine.sql to start the price change log.</p>
              ) : (
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-gray-50 text-left text-gray-500">
                    <tr>
                      <th className="p-3 font-medium">When</th>
                      <th className="p-3 font-medium">Who</th>
                      <th className="p-3 font-medium">What</th>
                      <th className="p-3 font-medium">From</th>
                      <th className="p-3 font-medium">To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.log.length === 0 ? <tr><td colSpan={5} className="p-4 text-gray-500">No price changes yet.</td></tr> : null}
                    {data.log.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 align-top">
                        <td className="p-3 whitespace-nowrap">{formatDateTime(row.at)}</td>
                        <td className="p-3">{row.actor}</td>
                        <td className="p-3">
                          <p>{row.field}{row.portal ? ` · ${row.portal}` : ''}</p>
                          <p className="text-[10px] text-gray-500">{row.product || row.company || ''}</p>
                        </td>
                        <td className="p-3 max-w-xs break-words">{row.oldValue || '—'}</td>
                        <td className="p-3 max-w-xs break-words">{row.newValue || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ),
        }}
      />
      {!canEdit ? <p className="text-xs text-gray-500">You can view prices. Admin and accounts can edit them.</p> : null}
    </div>
  )
}
