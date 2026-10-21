import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, isUuid, oneRelation } from '@/lib/utils'
import { setCatalogProductVisibility, removeCatalogProduct, setCatalogManualPrice, updateCatalog, removeCatalog } from '../actions'
import { CatalogProductPicker } from '../CatalogProductPicker'
import { ProductImage } from '@/components/ui/product-image'
import { CatalogDuplicateForm } from '../CatalogDuplicateForm'
import { CatalogAssignPanel } from '../CatalogAssignPanel'
import { CatalogSharePanel } from '../CatalogSharePanel'
import { CatalogPublishButton } from '../CatalogPublishButton'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { BackButton } from '@/components/ui/back-button'
import { CatalogForm } from '../CatalogForm'
import { requireStaff } from '@/lib/auth'
import { SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { catalogStatusLabel } from '@/lib/catalogs/status'
import { listCatalogPickerProducts } from '@/lib/catalogs/picker-products'
import { shareLinkOrigin } from '@/lib/auth/request-origin'
import { sharePath } from '@/lib/catalogs/share'
import { shareLinkIsExpired } from '@/lib/catalogs/share-link'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'
import { defaultCatalogCompanyId, offeringPricesForCompany } from '@/lib/catalogs/pricing'
import { hiddenCatalogItemsByCompany } from '@/lib/catalogs/visibility-data'

export default async function CatalogDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ removed?: string; preview?: string }>
}) {
  const { id } = await params
  const { removed, preview } = await searchParams
  if (!isUuid(id)) notFound()
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()

  const [{ data: catalog }, { data: offerings }, { data: selections }, { data: companies }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(id, name)').eq('id', id).maybeSingle(),
    supabase.from('campaign_products').select('*, product:products(id, name, sku, price, status, image_url)').eq('campaign_id', id).order('display_order'),
    supabase.from('client_product_selections').select('*, selector:profiles!user_id(full_name, email), offering:campaign_products(display_name)').eq('campaign_id', id).order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])

  if (!catalog) notFound()

  const [assignmentResult, shareResult, pickerProducts, origin] = await Promise.all([
    supabase.from('catalog_assignments').select('company_id, company:companies(id, name)').eq('campaign_id', id),
    (async () => {
      const query = (columns: string) =>
        supabase
          .from('catalog_share_links')
          .select(columns)
          .eq('campaign_id', id)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
      const withCompany = await query('token, expires_at, revoked_at, company_id')
      // company_id arrives with migration 20261009; links keep working without it.
      return withCompany.error && /company_id/i.test(withCompany.error.message)
        ? query('token, expires_at, revoked_at')
        : withCompany
    })(),
    listCatalogPickerProducts(catalog.company_id),
    shareLinkOrigin(),
  ])

  const company = oneRelation(catalog.company)
  const assigned = assignmentResult.error
    ? (company ? [{ companyId: company.id, name: company.name }] : [])
    : (assignmentResult.data || []).map((row) => {
      const rowCompany = oneRelation(row.company as { id: string; name: string } | { id: string; name: string }[] | null)
      return { companyId: row.company_id as string, name: rowCompany?.name || 'Company' }
    })
  const companyOptions = (companies || []) as { id: string; name: string }[]
  const hiddenByCompany = await hiddenCatalogItemsByCompany(
    companyOptions.map((company) => company.id),
    (offerings || []).map((row) => {
      const product = Array.isArray(row.product) ? row.product[0] : row.product
      return {
        productId: row.product_id as string,
        name: (row.display_name as string | null) || product?.name || product?.sku || 'Item',
      }
    }),
  )
  const defaultCompanyId = (await defaultCatalogCompanyId(id)) || assigned[0]?.companyId || null
  const previewCompanyId =
    preview && assigned.some((row) => row.companyId === preview) ? preview : defaultCompanyId
  const previewCompany = assigned.find((row) => row.companyId === previewCompanyId) || null
  const previewPrices = await offeringPricesForCompany((offerings || []).map((row) => row.id), previewCompanyId)
  const draftCount = (offerings || []).filter((row) => {
    const rowProduct = Array.isArray(row.product) ? row.product[0] : row.product
    return row.visibility !== 'published' && rowProduct?.status === 'active'
  }).length
  const offeredIds = new Set((offerings || []).map((offering) => offering.product_id))
  const available = pickerProducts.filter((product) => !offeredIds.has(product.id))
  const kitMembersById = new Map<string, NonNullable<typeof offerings>>()
  for (const row of offerings || []) {
    if (!row.pack_kit_id) continue
    const list = kitMembersById.get(row.pack_kit_id) || []
    list.push(row)
    kitMembersById.set(row.pack_kit_id, list)
  }

  let sourceName: string | null = null
  if (catalog.cloned_from) {
    const { data: source } = await supabase.from('campaigns').select('name').eq('id', catalog.cloned_from).maybeSingle()
    sourceName = source?.name || null
  }

  const assignedIds = assigned.map((row) => row.companyId).filter(Boolean)
  const contactResult = assignedIds.length
    ? await supabase
      .from('contacts')
      .select('full_name, email')
      .in('company_id', assignedIds)
      .not('email', 'is', null)
      .limit(20)
    : { data: [] }
  const suggestions = (contactResult.data || [])
    .filter((contact) => contact.email)
    .map((contact) => ({ email: contact.email as string, label: contact.full_name || contact.email as string }))

  const activeLink = (shareResult.error ? null : (shareResult.data as unknown as { token: string; expires_at: string | null; company_id?: string | null }[] | null)?.[0]) || null
  const linkCompanyName = assigned.find((row) => row.companyId === activeLink?.company_id)?.name || null
  const shareUrl = activeLink?.token ? `${origin}${sharePath(activeLink.token)}` : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton href="/crm/catalogs" label="Back to catalogs" />
      {removed === 'archived' && (
        <div className="rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 p-3 text-xs text-[#9E4300]">
          This catalog cannot be permanently deleted because it has existing orders. It was closed instead.
        </div>
      )}
      {(assignmentResult.error || shareResult.error) && (
        <div className="rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 p-3 text-xs text-[#9E4300]">
          Assignment and share links need the catalogs migration applied before they can be saved.
        </div>
      )}

      {/* Header Panel */}
      <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
          <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
          <span>/</span>
          <Link href="/crm/catalogs" className="hover:text-[#9E4300] transition-colors">Catalogs</Link>
          <span>/</span>
          <span className="text-[#9E4300] font-semibold">{catalog.id.slice(0, 8)}</span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-0.5 text-[11px] uppercase text-[#4A4640]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9E4300]" />
                {catalogStatusLabel(catalog.status)}
              </span>
              {catalog.published_to_client_at ? (
                <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2.5 py-0.5 text-[11px] uppercase text-[#3A4537]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> Published to client
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2.5 py-0.5 text-[11px] uppercase text-[#7C766F]">
                  Draft
                </span>
              )}
            </div>
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              {catalog.name}
            </h1>
            <p className="text-xs text-[#4A4640] mt-1.5">
              Company: <span className="font-semibold text-[#1C1B1A]">{assigned.length ? assigned.map((row) => row.name).join(', ') : 'Unassigned'}</span>
              {sourceName ? <> · Duplicated from <span className="font-semibold text-[#1C1B1A]">{sourceName}</span></> : null}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CatalogPublishButton catalogId={catalog.id} draftCount={draftCount} published={Boolean(catalog.published_to_client_at)} />
            <ConfirmAction
              title="Remove catalog?"
              confirmLabel="Delete"
              action={removeCatalog}
              hiddenFields={{ id: catalog.id }}
              description={<p>Catalog: <span className="font-semibold text-[#1C1B1A]">{catalog.name}</span>. If it has orders it will be closed instead of deleted.</p>}
            >
              Delete catalog
            </ConfirmAction>
          </div>
        </div>

        {/* Dense Key/Value KPI Strip */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 pt-5 border-t border-[#CCC5BD]">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Employees</span>
            <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-0.5 block">{catalog.employee_quantity?.toLocaleString('en-IN') || 0}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Budget / person</span>
            <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-0.5 block">{formatCurrency(catalog.budget_per_employee)}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total budget</span>
            <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-0.5 block">{formatCurrency(catalog.total_budget)}</span>
          </div>
        </div>
      </div>

      {/* Catalog Details Form */}
      <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
        <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
          <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">
            Edit Catalog Details
          </h2>
        </div>

        <CatalogForm action={updateCatalog} className="grid gap-3 text-xs md:grid-cols-3">
          <input type="hidden" name="id" value={catalog.id} />
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Catalog Name</label>
            <input
              name="name"
              required
              defaultValue={catalog.name}
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Occasion</label>
            <input
              name="occasion"
              defaultValue={catalog.occasion || ''}
              placeholder="Occasion"
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Employee Quantity</label>
            <input
              name="employee_quantity"
              type="number"
              min="1"
              defaultValue={catalog.employee_quantity || 1}
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Budget Per Employee</label>
            <input
              name="budget_per_employee"
              type="number"
              step="0.01"
              min="0"
              defaultValue={catalog.budget_per_employee || 0}
              className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <SheetDateField name="required_delivery_date" label="Required delivery" defaultValue={catalog.required_delivery_date || ''} />
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Notes / Description</label>
            <input
              name="description"
              defaultValue={catalog.description || ''}
              placeholder="Notes"
              className="min-h-10 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
            />
          </div>
          <button className="min-h-10 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors md:col-span-3">
            Save catalog
          </button>
        </CatalogForm>
      </div>

      <CatalogDuplicateForm catalogId={catalog.id} defaultName={catalog.name} />
      <CatalogAssignPanel
        catalogId={catalog.id}
        assigned={assigned}
        companies={companyOptions}
        defaultCompanyName={assigned.find((row) => row.companyId === defaultCompanyId)?.name || company?.name || null}
        hiddenByCompany={hiddenByCompany}
      />
      <CatalogSharePanel
        key={catalog.id}
        catalogId={catalog.id}
        catalogName={catalog.name}
        shareUrl={shareUrl}
        expiresAt={activeLink?.expires_at || null}
        linkExpired={shareLinkIsExpired(activeLink?.expires_at)}
        suggestions={suggestions}
        companies={assigned.map((row) => ({ id: row.companyId, name: row.name }))}
        linkCompanyName={linkCompanyName}
      />

      <CatalogProductPicker catalogId={catalog.id} products={available} />

      <form method="get" className="flex flex-col gap-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-xs sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
          Preview prices as
          <select
            name="preview"
            defaultValue={previewCompanyId || ''}
            disabled={assigned.length === 0}
            className="min-h-9 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-1.5 text-xs font-normal normal-case text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
          >
            {assigned.length === 0 && <option value="">Assign a company first</option>}
            {assigned.map((row) => (
              <option key={row.companyId} value={row.companyId}>{row.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={assigned.length === 0} className="min-h-9 rounded-none border border-[#1C1B1A] bg-transparent px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#F6F3EC] transition-colors disabled:opacity-50">
          Preview
        </button>
        <p className="text-[11px] text-[#7C766F] sm:ml-auto">
          Price order: company special price, then a manual price on the line, then base price plus that company&apos;s margin. Existing pack rows keep the price they were saved with.
        </p>
      </form>

      <div className="overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
            <tr>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Pack</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client offering</th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client price{previewCompany ? ` (${previewCompany.name})` : ''}</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Visibility</th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {(offerings || [])
              .filter((row) => row.pack_kit_role !== 'line')
              .map((row) => {
                const product = Array.isArray(row.product) ? row.product[0] : row.product
                const discontinued = product?.status && product.status !== 'active'
                const kitMembers = row.pack_kit_id ? kitMembersById.get(row.pack_kit_id) || [] : []
                const kitLines = kitMembers.filter((line) => line.id !== row.id)
                return (
                  <tr key={row.id} className="transition-colors hover:bg-[#F6F3EC]">
                    <td className="px-3.5 py-3 font-mono font-semibold text-[#9E4300]">{row.pack_option || '—'}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F6F3EC]">
                          <ProductImage src={row.client_image_url || product?.image_url} alt={row.display_name || product?.name || 'Product'} size="sm" fit="cover" className="h-full w-full rounded-none" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#1C1B1A]">{row.display_name || product?.name}</p>
                          <p className="font-mono text-[11px] text-[#7C766F]">{product?.sku} · base {formatCurrency(product?.price)}</p>
                          {kitLines.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-[#4A4640]">
                              {kitLines.map((line) => {
                                const lineProduct = Array.isArray(line.product) ? line.product[0] : line.product
                                return (
                                  <li key={line.id}>
                                    + {line.display_name || lineProduct?.name} (<span className="font-mono">{formatCurrency(line.selling_price)}</span>)
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                          {discontinued ? (
                            <span className="mt-1 inline-block rounded-none border border-[#BA1A1A]/40 bg-[#FBEDEB] px-2 py-0.5 text-[10px] uppercase text-[#BA1A1A]">
                              Master product discontinued — unpublish or replace
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-right">
                      {row.pack_kit_total != null ? (
                        <>
                          <p className="font-mono font-semibold text-[#1C1B1A]">{formatCurrency(row.pack_kit_total)}</p>
                          <p className="text-[10px] uppercase text-[#7C766F]">kit total</p>
                        </>
                      ) : (
                        <>
                          <p className="font-mono font-semibold text-[#1C1B1A]">{formatCurrency(previewPrices.get(row.id) ?? row.selling_price)}</p>
                          {row.manual_price != null && (
                            <span className="inline-block mt-0.5 rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-1.5 py-0.2 text-[10px] uppercase text-[#9E4300]">manual price</span>
                          )}
                          {row.pack_option && row.priced_company_id && (
                            <p className="text-[10px] text-[#7C766F] mt-0.5">
                              priced for {assigned.find((a) => a.companyId === row.priced_company_id)?.name || 'one company'}
                            </p>
                          )}
                        </>
                      )}
                      {!row.pack_option && (
                        <ActionForm action={setCatalogManualPrice} className="mt-2 flex items-center justify-end gap-1.5">
                          <input type="hidden" name="campaign_id" value={catalog.id} />
                          <input type="hidden" name="id" value={row.id} />
                          <input
                            name="manual_price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={row.manual_price ?? ''}
                            placeholder="Manual"
                            aria-label="Manual price"
                            className="w-20 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                          />
                          <SubmitButton className="text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:underline" pendingLabel="Saving…">Set</SubmitButton>
                        </ActionForm>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      {row.visibility === 'published' ? (
                        <span className="inline-flex items-center gap-1 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[11px] uppercase text-[#3A4537]">
                          <span className="h-1 w-1 rounded-full bg-[#3A4537]" /> published
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] uppercase text-[#7C766F]">
                          {row.visibility}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3 text-right space-x-2">
                      {row.visibility !== 'published' ? (
                        discontinued ? (
                          <span className="text-[11px] text-[#7C766F]">Cannot publish</span>
                        ) : (
                          <ActionForm action={setCatalogProductVisibility} className="inline">
                            <input type="hidden" name="campaign_id" value={catalog.id} />
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="visibility" value="published" />
                            <SubmitButton className="text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:underline" pendingLabel="Publishing…">Publish to client</SubmitButton>
                          </ActionForm>
                        )
                      ) : (
                        <ActionForm action={setCatalogProductVisibility} className="inline">
                          <input type="hidden" name="campaign_id" value={catalog.id} />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="visibility" value="unpublished" />
                          <SubmitButton className="text-xs font-bold uppercase tracking-[0.12em] text-[#4A4640] hover:underline" pendingLabel="Saving…">Unpublish</SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={removeCatalogProduct} className="inline">
                        <input type="hidden" name="campaign_id" value={catalog.id} />
                        <input type="hidden" name="id" value={row.id} />
                        <SubmitButton className="text-xs font-bold uppercase tracking-[0.12em] text-[#BA1A1A] hover:underline" pendingLabel="Removing…">Remove</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
        <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
          <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Client selections</h2>
        </div>
        {(selections || []).length === 0 && <p className="text-xs text-[#7C766F]">No client selections yet.</p>}
        {(selections || []).map((selection) => {
          const person = Array.isArray(selection.selector) ? selection.selector[0] : selection.selector
          const offering = Array.isArray(selection.offering) ? selection.offering[0] : selection.offering
          return (
            <p key={selection.id} className="border-t border-[#CCC5BD] py-2 text-xs text-[#1C1B1A]">
              <span className="font-semibold text-[#1C1B1A]">{person?.full_name || person?.email || 'Client'}</span> · {offering?.display_name || 'Product'} · {selection.kind} · qty <span className="font-mono font-medium">{selection.quantity}</span> {selection.comment ? `· ${selection.comment}` : ''}
            </p>
          )
        })}
      </div>
    </div>
  )
}
