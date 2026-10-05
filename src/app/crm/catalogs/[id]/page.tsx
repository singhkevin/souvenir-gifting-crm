import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatCurrency, isUuid, oneRelation } from '@/lib/utils'
import { setCatalogProductVisibility, removeCatalogProduct, updateCatalog, removeCatalog } from '../actions'
import { BudgetPackGenerator } from '../BudgetPackGenerator'
import { CatalogProductPicker } from '../CatalogProductPicker'
import { CatalogDuplicateForm } from '../CatalogDuplicateForm'
import { CatalogAssignPanel } from '../CatalogAssignPanel'
import { CatalogSharePanel } from '../CatalogSharePanel'
import { CatalogPublishButton } from '../CatalogPublishButton'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { BackButton } from '@/components/ui/back-button'
import { asFormAction } from '@/lib/form-action'
import { CatalogForm } from '../CatalogForm'
import { requireStaff } from '@/lib/auth'
import { SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { catalogStatusLabel } from '@/lib/catalogs/status'
import { listCatalogPickerProducts } from '@/lib/catalogs/picker-products'
import { requestOrigin } from '@/lib/auth/request-origin'
import { sharePath } from '@/lib/catalogs/share'
import { resendIsConfigured } from '@/lib/email/resend-config'
import { shareLinkIsExpired } from '@/lib/catalogs/share-link'

export default async function CatalogDetailPage({
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

  const [{ data: catalog }, { data: offerings }, { data: selections }, { data: companies }] = await Promise.all([
    supabase.from('campaigns').select('*, company:companies(id, name)').eq('id', id).maybeSingle(),
    supabase.from('campaign_products').select('*, product:products(id, name, sku, price, status)').eq('campaign_id', id).order('display_order'),
    supabase.from('client_product_selections').select('*, selector:profiles!user_id(full_name, email), offering:campaign_products(display_name)').eq('campaign_id', id).order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name').order('name'),
  ])

  if (!catalog) notFound()

  const [assignmentResult, shareResult, pickerProducts, origin] = await Promise.all([
    supabase.from('catalog_assignments').select('company_id, company:companies(id, name)').eq('campaign_id', id),
    supabase
      .from('catalog_share_links')
      .select('token, expires_at, revoked_at')
      .eq('campaign_id', id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
      .limit(1),
    listCatalogPickerProducts(catalog.company_id),
    requestOrigin(),
  ])

  const company = oneRelation(catalog.company)
  const assigned = assignmentResult.error
    ? (company ? [{ companyId: company.id, name: company.name }] : [])
    : (assignmentResult.data || []).map((row) => {
      const rowCompany = oneRelation(row.company as { id: string; name: string } | { id: string; name: string }[] | null)
      return { companyId: row.company_id as string, name: rowCompany?.name || 'Company' }
    })
  const companyOptions = (companies || []) as { id: string; name: string }[]
  const offeredIds = new Set((offerings || []).map((offering) => offering.product_id))
  const available = pickerProducts.filter((product) => !offeredIds.has(product.id))
  const packKits = (offerings || []).filter((offering) => offering.pack_option && offering.pack_kit_role !== 'line')
  const draftPackCount = packKits.filter((offering) => offering.visibility === 'draft').length
  const publishedPackCount = packKits.filter((offering) => offering.visibility === 'published').length
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

  const activeLink = shareResult.error ? null : shareResult.data?.[0] || null
  const shareUrl = activeLink?.token ? `${origin}${sharePath(activeLink.token)}` : null

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackButton href="/crm/catalogs" label="Back to catalogs" />
      {removed === 'archived' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          This catalog cannot be permanently deleted because it has existing orders. It was closed instead.
        </div>
      )}
      {(assignmentResult.error || shareResult.error) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Assignment and share links need the catalogs migration applied before they can be saved.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl">{catalog.name}</h1>
          <p className="mt-1 text-xs text-[#7A7267]">
            {assigned.length ? assigned.map((row) => row.name).join(', ') : 'Unassigned'} · {catalog.employee_quantity?.toLocaleString('en-IN')} employees · {formatCurrency(catalog.budget_per_employee)} / person · {formatCurrency(catalog.total_budget)} total
          </p>
          <p className="mt-1 text-xs">
            Status: {catalogStatusLabel(catalog.status)} · {catalog.published_to_client_at ? 'Published to client' : 'Draft'}
          </p>
          {sourceName && (
            <p className="mt-1 text-xs text-[#7A7267]">Duplicated from {sourceName}</p>
          )}
        </div>
        <CatalogPublishButton catalogId={catalog.id} />
      </div>
      <div>
        <ConfirmAction
          title="Remove catalog?"
          confirmLabel="Delete"
          action={asFormAction(removeCatalog)}
          hiddenFields={{ id: catalog.id }}
          description={<p>Catalog: <span className="font-semibold">{catalog.name}</span>. If it has orders it will be closed instead of deleted.</p>}
        >
          Delete catalog
        </ConfirmAction>
      </div>

      <CatalogForm action={updateCatalog} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3">
        <input type="hidden" name="id" value={catalog.id} />
        <input name="name" required defaultValue={catalog.name} className="rounded-lg border px-3 py-2" />
        <input name="occasion" defaultValue={catalog.occasion || ''} placeholder="Occasion" className="rounded-lg border px-3 py-2" />
        <input name="employee_quantity" type="number" min="1" defaultValue={catalog.employee_quantity || 1} className="rounded-lg border px-3 py-2" />
        <input name="budget_per_employee" type="number" step="0.01" min="0" defaultValue={catalog.budget_per_employee || 0} className="rounded-lg border px-3 py-2" />
        <SheetDateField name="required_delivery_date" label="Required delivery" defaultValue={catalog.required_delivery_date || ''} />
        <input name="description" defaultValue={catalog.description || ''} placeholder="Notes" className="min-h-11 rounded-lg border px-3 py-2" />
        <button className="min-h-11 rounded-lg bg-[#806A50] font-semibold text-[#FFFFFF]">Save catalog</button>
      </CatalogForm>

      <CatalogDuplicateForm catalogId={catalog.id} defaultName={catalog.name} companies={companyOptions} />
      <CatalogAssignPanel
        catalogId={catalog.id}
        assigned={assigned}
        companies={companyOptions}
        pricingCompanyName={company?.name || null}
      />
      <CatalogSharePanel
        key={catalog.id}
        catalogId={catalog.id}
        catalogName={catalog.name}
        shareUrl={shareUrl}
        expiresAt={activeLink?.expires_at || null}
        linkExpired={shareLinkIsExpired(activeLink?.expires_at)}
        emailConfigured={resendIsConfigured()}
        suggestions={suggestions}
      />

      <BudgetPackGenerator
        catalogId={catalog.id}
        budgetPerEmployee={catalog.budget_per_employee}
        draftPackCount={draftPackCount}
        publishedPackCount={publishedPackCount}
      />

      <CatalogProductPicker catalogId={catalog.id} products={available} />

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-xs">
          <thead className="bg-[#FAF7F2] text-left">
            <tr>
              <th className="p-3">Pack</th>
              <th className="p-3">Client offering</th>
              <th className="p-3">Client price</th>
              <th className="p-3">Visibility</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(offerings || [])
              .filter((row) => row.pack_kit_role !== 'line')
              .map((row) => {
                const product = Array.isArray(row.product) ? row.product[0] : row.product
                const discontinued = product?.status && product.status !== 'active'
                const kitMembers = row.pack_kit_id ? kitMembersById.get(row.pack_kit_id) || [] : []
                const kitLines = kitMembers.filter((line) => line.id !== row.id)
                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-semibold text-[#806A50]">{row.pack_option || '—'}</td>
                    <td className="p-3">
                      <p className="font-semibold">{row.display_name || product?.name}</p>
                      <p className="text-[#7A7267]">{product?.sku} · list {formatCurrency(product?.price)}</p>
                      {kitLines.length > 0 && (
                        <ul className="mt-2 space-y-0.5 text-[11px] text-[#5A5248]">
                          {kitLines.map((line) => {
                            const lineProduct = Array.isArray(line.product) ? line.product[0] : line.product
                            return (
                              <li key={line.id}>
                                + {line.display_name || lineProduct?.name} ({formatCurrency(line.selling_price)})
                              </li>
                            )
                          })}
                        </ul>
                      )}
                      {discontinued ? (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          Master product discontinued — unpublish or replace
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3">
                      {row.pack_kit_total != null ? (
                        <>
                          <p className="font-semibold">{formatCurrency(row.pack_kit_total)}</p>
                          <p className="text-[10px] text-[#7A7267]">kit total</p>
                        </>
                      ) : (
                        formatCurrency(row.selling_price)
                      )}
                    </td>
                    <td className="p-3 capitalize">{row.visibility}</td>
                    <td className="space-x-2 p-3">
                      {row.visibility !== 'published' ? (
                        discontinued ? (
                          <span className="text-[#7A7267]">Cannot publish</span>
                        ) : (
                          <form action={asFormAction(setCatalogProductVisibility)} className="inline">
                            <input type="hidden" name="campaign_id" value={catalog.id} />
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="visibility" value="published" />
                            <button className="underline text-[#806A50]">Publish to client</button>
                          </form>
                        )
                      ) : (
                        <form action={asFormAction(setCatalogProductVisibility)} className="inline">
                          <input type="hidden" name="campaign_id" value={catalog.id} />
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="visibility" value="unpublished" />
                          <button className="underline">Unpublish</button>
                        </form>
                      )}
                      <form action={asFormAction(removeCatalogProduct)} className="inline">
                        <input type="hidden" name="campaign_id" value={catalog.id} />
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

      <div className="rounded-2xl border bg-white p-5">
        <h2 className="mb-3 font-serif text-lg">Client selections</h2>
        {(selections || []).length === 0 && <p className="text-sm text-gray-500">No client selections yet.</p>}
        {(selections || []).map((selection) => {
          const person = Array.isArray(selection.selector) ? selection.selector[0] : selection.selector
          const offering = Array.isArray(selection.offering) ? selection.offering[0] : selection.offering
          return (
            <p key={selection.id} className="border-t py-1 text-sm">
              {person?.full_name || person?.email || 'Client'} · {offering?.display_name || 'Product'} · {selection.kind} · qty {selection.quantity} {selection.comment ? `· ${selection.comment}` : ''}
            </p>
          )
        })}
      </div>
    </div>
  )
}
