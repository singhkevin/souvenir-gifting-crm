import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid } from '@/lib/utils'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { ProductImage } from '@/components/ui/product-image'
import { requireStaff } from '@/lib/auth'
import { getCompanyMarginPercent, sellPricesForSurface } from '@/lib/pricing/server'
import {
  updateRequirementForm,
  removeRequirement,
  addProductToRequirement,
  removeProductFromRequirement,
  updateRequirementProductQty,
  createQuotationFromRequirement,
} from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { ActionForm } from '@/components/ui/action-form'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'
import { SubmitButton } from '@/components/ui/submit-button'

export default async function RequirementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string; removed?: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { tab = 'overview', removed } = await searchParams
  await requireStaff(['admin', 'sales', 'management'])
  const supabase = await createClient()

  const [
    { data: req },
    { data: products },
    { data: quotations },
    { data: activities },
    { data: relatedOrders },
    { data: catalogueProducts },
  ] = await Promise.all([
    supabase
      .from('requirements')
      .select(`
        *,
        company:companies(id, name),
        contact:contacts(id, full_name, email, phone),
        owner:profiles!requirements_owner_id_fkey(id, full_name)
      `)
      .eq('id', id)
      .maybeSingle(),
    supabase.from('requirement_products').select('*, product:products(*)').eq('requirement_id', id),
    supabase.from('quotations').select('*').eq('requirement_id', id).order('created_at', { ascending: false }),
    supabase
      .from('activities')
      .select('*, created_by_profile:profiles!activities_created_by_fkey(id, full_name)')
      .eq('related_type', 'requirement')
      .eq('related_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('requirement_id', id)
      .order('created_at', { ascending: false })
      .limit(1),
    supabase.from('products').select('id, name, sku, status').eq('status', 'active').order('name'),
  ])

  if (!req) notFound()
  const fromBasket = req.source === 'business_portal'

  const companyId = (req.company as { id?: string } | null)?.id
  const businessMetaQuery = companyId
    ? await supabase.from('companies').select('account_type, business_verification, gst_number').eq('id', companyId).maybeSingle()
    : { data: null, error: null }
  const businessMeta = businessMetaQuery.error ? null : businessMetaQuery.data

  // Line price shown = the calculated price for this company (no products.price).
  const companyMargin = companyId ? await getCompanyMarginPercent(companyId) : null
  const lineIds = ((products || []) as { product_id?: string | null }[]).flatMap((row) => (row.product_id ? [row.product_id] : []))
  const linePrices = await sellPricesForSurface(lineIds, 'portal', companyMargin, companyId || null)
  const productRows = products || []
  const quoteRows = quotations || []
  const order = relatedOrders?.[0] || null
  const latestQuote = quoteRows[0] || null
  const acceptedQuote =
    quoteRows.find((q: { status?: string | null }) => q.status === 'accepted') || null
  const attachedIds = new Set(productRows.map((p: { product_id: string }) => p.product_id))
  const assignableProducts = (catalogueProducts || []).filter((p) => !attachedIds.has(p.id))

  const hasProducts = productRows.length > 0
  const hasQuotes = quoteRows.length > 0
  const hasOrder = Boolean(order)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/requirements" label="Back to Requirements" />
      {removed === 'archived' && (
        <div className="rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 p-3 text-xs text-[#9E4300]">
          This requirement cannot be permanently deleted because it has quotations or orders. It was
          closed instead.
        </div>
      )}

      {/* Header Panel */}
      <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
              <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
              <span>/</span>
              <Link href="/crm/requirements" className="hover:text-[#9E4300] transition-colors">Requirements</Link>
              <span>/</span>
              <span className="text-[#9E4300] font-semibold">{req.id.slice(0, 8)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#F6F3EC] text-[#4A4640] border border-[#CCC5BD] rounded-none">
                <ClipboardList size={13} className="text-[#9E4300]" /> Client Brief
              </span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-none  text-[11px] uppercase ${
                ['active', 'won'].includes(req.status)
                  ? 'bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20'
                  : ['lost', 'closed'].includes(req.status)
                    ? 'bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40'
                    : 'bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30'
              }`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> {req.status}
              </span>
            </div>

            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
              {req.name}
            </h1>
            {req.source === 'business_portal' ? (
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">Business portal</p>
            ) : null}
            {req.source === 'website' ? (
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3A4537]">Website quote request</p>
            ) : null}
            <p className="text-xs text-[#4A4640] mt-1.5">
              Company:{' '}
              <Link
                href={`/crm/companies/${(req.company as { id?: string })?.id}`}
                className="font-semibold text-[#1C1B1A] hover:text-[#9E4300] transition-colors"
              >
                {(req.company as { name?: string })?.name}
              </Link>
              {(businessMeta?.account_type === 'business') ? (
                <span className="ml-2 text-[11px] uppercase text-[#9E4300]">
                  {businessMeta.business_verification || 'unverified'}
                  {businessMeta.gst_number ? ` · GSTIN ${businessMeta.gst_number}` : ''}
                </span>
              ) : null}
              {' · '}
              Owner:{' '}
              <span className="font-medium text-[#1C1B1A]">
                {(req.owner as { full_name?: string | null })?.full_name || 'Unassigned'}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 bg-[#F6F3EC] p-3.5 rounded-none border border-[#CCC5BD]">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">{fromBasket ? 'Budget per kit' : 'Total Budget'}</span>
                <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-0.5 block">{formatCurrency(req.budget)}</span>
              </div>
              <div className="border-l border-[#CCC5BD] pl-4">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Target Qty</span>
                <span className="font-mono text-xl font-bold text-[#1C1B1A] mt-0.5 block">{req.quantity || '—'} units</span>
              </div>
            </div>
            <ConfirmAction
              title="Remove requirement?"
              confirmLabel="Delete"
              action={removeRequirement}
              hiddenFields={{ id: req.id }}
              description={
                <p>
                  Requirement: <span className="font-semibold text-[#1C1B1A]">{req.name}</span>. If quotations or
                  orders exist it will be closed instead of deleted.
                </p>
              }
            >
              Delete
            </ConfirmAction>
          </div>
        </div>

        {/* Workflow Lifecycle Steps */}
        <div className="rounded-none border border-[#CCC5BD] bg-[#F6F3EC] p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
            <span
              className={`px-2.5 py-1 rounded-none border ${
                hasProducts ? 'bg-[#DAE6D3] text-[#3A4537] border-[#3A4537]/20 font-mono' : 'bg-[#FCF9F2] text-[#7C766F] border-[#CCC5BD]'
              }`}
            >
              1. Products{hasProducts ? ` (${productRows.length})` : ''}
            </span>
            <span className="text-[#CCC5BD]">→</span>
            <span
              className={`px-2.5 py-1 rounded-none border ${
                hasQuotes ? 'bg-[#DAE6D3] text-[#3A4537] border-[#3A4537]/20 font-mono' : 'bg-[#FCF9F2] text-[#7C766F] border-[#CCC5BD]'
              }`}
            >
              2. Quotation{hasQuotes ? ` (${quoteRows.length})` : ''}
            </span>
            <span className="text-[#CCC5BD]">→</span>
            <span
              className={`px-2.5 py-1 rounded-none border ${
                hasOrder ? 'bg-[#DAE6D3] text-[#3A4537] border-[#3A4537]/20 font-mono' : 'bg-[#FCF9F2] text-[#7C766F] border-[#CCC5BD]'
              }`}
            >
              3. Order / fulfilment
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {!hasProducts && (
              <Link
                href={`?tab=products`}
                className="inline-flex items-center gap-1.5 rounded-none bg-[#1C1B1A] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
              >
                <Plus size={14} /> Add products
              </Link>
            )}
            {hasProducts && !hasQuotes && (
              <ActionForm action={createQuotationFromRequirement} className="inline">
                <input type="hidden" name="requirement_id" value={req.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-none bg-[#1C1B1A] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
                >
                  Create quotation
                </button>
              </ActionForm>
            )}
            {hasQuotes && latestQuote && (
              <Link
                href={`/crm/quotations/${latestQuote.id}`}
                className="inline-flex items-center rounded-none border border-[#1C1B1A] bg-transparent px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#FCF9F2] transition-colors"
              >
                Open latest quotation
              </Link>
            )}
            {acceptedQuote && !hasOrder && (
              <Link
                href={`/crm/quotations/${acceptedQuote.id}`}
                className="inline-flex items-center rounded-none border border-[#3A4537]/40 bg-[#DAE6D3] px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#3A4537] hover:bg-[#c9dac0] transition-colors"
              >
                Open quotation to convert
              </Link>
            )}
            {order && (
              <Link
                href={`/crm/orders/${order.id}`}
                className="inline-flex items-center rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:bg-[#FFB690]/50 transition-colors"
              >
                View order {order.order_number || ''}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-[#CCC5BD]">
        <nav className="flex space-x-6">
          {['overview', 'products', 'quotations', 'activities'].map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              className={`pb-3 text-xs font-bold uppercase tracking-[0.12em] capitalize transition-colors border-b-2 ${
                tab === t
                  ? 'border-[#9E4300] text-[#9E4300]'
                  : 'border-transparent text-[#7C766F] hover:text-[#1C1B1A]'
              }`}
            >
              {t}
              {t === 'products' ? ` (${productRows.length})` : ''}
              {t === 'quotations' ? ` (${quoteRows.length})` : ''}
            </Link>
          ))}
        </nav>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 text-xs space-y-4">
              <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
                <h3 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">
                  {fromBasket ? 'Overall note' : 'Brief Description & Objectives'}
                </h3>
              </div>
              <p className="text-[#4A4640] whitespace-pre-wrap leading-relaxed text-xs">
                {req.description || 'No detailed description provided.'}
              </p>
              <ActionForm action={updateRequirementForm}
                className="grid md:grid-cols-2 gap-3 pt-4 border-t border-[#CCC5BD]"
              >
                <input type="hidden" name="id" value={req.id} />
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Name</label>
                  <input
                    name="name"
                    required
                    defaultValue={req.name}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Quantity</label>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={req.quantity || 1}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Budget per kit' : 'Budget'}</label>
                  <input
                    name="budget"
                    type="number"
                    step="0.01"
                    defaultValue={req.budget || ''}
                    placeholder="Budget"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Branding' : 'Purpose'}</label>
                  <input
                    name="purpose"
                    defaultValue={req.purpose || ''}
                    placeholder="Purpose"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Delivery locations' : 'Delivery City'}</label>
                  <input
                    name="delivery_city"
                    defaultValue={req.delivery_city || ''}
                    placeholder="Delivery city"
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Payment Terms</label>
                  <input
                    name="payment_terms"
                    defaultValue={req.payment_terms || ''}
                    placeholder="Payment terms"
                    className="min-h-10 w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <SheetDateField name="deadline" label={fromBasket ? 'Required by' : 'Deadline'} defaultValue={req.deadline || ''} />
                <div className="md:col-span-2">
                  <MobileSheetSelect
                    name="status"
                    label="Status"
                    defaultValue={req.status}
                    options={[
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                      { value: 'quoted', label: 'Quoted' },
                      { value: 'won', label: 'Won' },
                      { value: 'lost', label: 'Lost' },
                      { value: 'closed', label: 'Closed' },
                    ]}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Description</label>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={req.description || ''}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </div>
                <SubmitButton className="min-h-10 rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors md:col-span-2" pendingLabel="Saving…">
                  Save requirement
                </SubmitButton>
              </ActionForm>
            </div>

            <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 text-xs space-y-4">
              <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
                <h3 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">
                  Delivery & Commercial Terms
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Branding' : 'Purpose / Occasion'}</span>
                  <span className="font-semibold text-[#1C1B1A]">{req.purpose || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Delivery locations' : 'Delivery City'}</span>
                  <span className="font-semibold text-[#1C1B1A]">{req.delivery_city || '—'}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Payment Terms</span>
                  <span className="font-semibold text-[#1C1B1A]">
                    {req.payment_terms || 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">{fromBasket ? 'Required by' : 'Target Deadline'}</span>
                  <span className="font-mono font-semibold text-[#BA1A1A]">{formatDate(req.deadline)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 text-xs space-y-4">
              <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
                <h3 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Contact Person</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Name</span>
                  <span className="font-semibold text-[#1C1B1A]">
                    {(req.contact as { full_name?: string | null })?.full_name || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Email</span>
                  <span className="font-mono text-[#1C1B1A]">
                    {(req.contact as { email?: string | null })?.email || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Phone</span>
                  <span className="font-mono text-[#1C1B1A]">
                    {(req.contact as { phone?: string | null })?.phone || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4">
            {assignableProducts.length > 0 ? (
              <ActionForm action={addProductToRequirement}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="requirement_id" value={req.id} />
                <MobileSheetSelect
                  name="product_id"
                  label="Product"
                  required
                  className="w-full sm:flex-1"
                  emptyLabel="Select product to add..."
                  options={[
                    { value: '', label: 'Select product to add...' },
                    ...assignableProducts.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.sku})`,
                    })),
                  ]}
                />
                <label className="block w-full sm:w-28">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1.5">
                    Qty
                  </span>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={req.quantity || 1}
                    className="w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                  />
                </label>
                <SubmitButton
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-none bg-[#1C1B1A] px-4 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
                  pendingLabel="Adding…">
                  <Plus size={14} /> Add product
                </SubmitButton>
              </ActionForm>
            ) : (
              <p className="text-xs text-[#7C766F]">
                {catalogueProducts?.length
                  ? 'All active catalogue products are already on this brief.'
                  : 'No active catalogue products available to add.'}
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
                <tr>
                  <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Product</th>
                  <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Qty</th>
                  <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Price (₹)</th>
                  <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
                {productRows.map(
                  (item: {
                    id: string
                    quantity?: number | null
                    notes?: string | null
                    target_unit_price?: number | null
                    alt_quantities?: number[] | null
                    product?: {
                      id?: string
                      name?: string
                      sku?: string
                      price?: number | null
                      image_url?: string | null
                    } | null
                  }) => (
                    <tr key={item.id} className="transition-colors hover:bg-[#F6F3EC]">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden border border-[#CCC5BD] bg-[#F6F3EC]">
                            <ProductImage src={item.product?.image_url} alt={item.product?.name || 'Product'} size="sm" fit="cover" className="h-full w-full rounded-none" />
                          </div>
                          <div>
                            <Link
                              href={`/crm/products/${item.product?.id}`}
                              className="font-semibold text-[#1C1B1A] hover:text-[#9E4300] transition-colors"
                            >
                              {item.product?.name || 'Product'}
                            </Link>
                            <div className="font-mono text-[11px] text-[#7C766F]">
                              {item.product?.sku}
                            </div>
                            {item.notes ? (
                              <p className="mt-0.5 text-[11px] text-[#4A4640]">
                                {fromBasket ? 'Branding or variant note · ' : ''}
                                {item.notes}
                              </p>
                            ) : null}
                            {item.target_unit_price != null ? (
                              <p className="text-[11px] text-[#7C766F]">Target <span className="font-mono">{formatCurrency(item.target_unit_price)}</span></p>
                            ) : null}
                            {item.alt_quantities?.length ? (
                              <p className="text-[11px] text-[#7C766F]">Breaks: <span className="font-mono">{item.alt_quantities.join(', ')}</span></p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <ActionForm action={updateRequirementProductQty}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="requirement_id" value={req.id} />
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={item.quantity || 1}
                            className="w-20 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-1.5 text-xs font-mono text-[#1C1B1A] focus:border-[#1C1B1A] focus:outline-none focus:ring-0"
                          />
                          <SubmitButton
                            className="text-xs font-bold uppercase tracking-[0.12em] text-[#9E4300] hover:underline"
                            pendingLabel="Saving…">
                            Save
                          </SubmitButton>
                        </ActionForm>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">
                        {item.product?.id && linePrices?.has(item.product.id)
                          ? (linePrices.get(item.product.id) == null ? 'On quote' : formatCurrency(linePrices.get(item.product.id)))
                          : '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <ActionForm action={removeProductFromRequirement} className="inline">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="requirement_id" value={req.id} />
                          <SubmitButton
                            className="inline-flex p-1.5 text-[#7C766F] hover:text-[#BA1A1A] hover:bg-[#FBEDEB] rounded-none transition-colors"
                            title="Remove product"
                            pendingLabel="Saving…">
                            <Trash2 size={14} />
                          </SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  )
                )}
                {productRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3.5 py-6 text-center text-[#7C766F]">
                      No products attached yet. Add products above, then create a quotation.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'quotations' && (
        <div className="space-y-4">
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-[#4A4640]">
              {hasProducts
                ? 'Generate a draft quotation from the products on this brief.'
                : 'Add products on the Products tab before creating a quotation.'}
            </p>
            {hasProducts ? (
              <ActionForm action={createQuotationFromRequirement} className="inline">
                <input type="hidden" name="requirement_id" value={req.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-none bg-[#1C1B1A] px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
                >
                  Create quotation
                </button>
              </ActionForm>
            ) : (
              <Link
                href="?tab=products"
                className="inline-flex items-center rounded-none border border-[#1C1B1A] bg-transparent px-3.5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#1C1B1A] hover:bg-[#FCF9F2] transition-colors"
              >
                Go to products
              </Link>
            )}
          </div>

          <div className="overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
                <tr>
                  <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Quote #</th>
                  <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total (₹)</th>
                  <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
                  <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
                {quoteRows.map(
                  (q: {
                    id: string
                    quotation_number?: string | null
                    total?: number | null
                    status?: string | null
                    created_at?: string
                  }) => (
                    <tr key={q.id} className="transition-colors hover:bg-[#F6F3EC]">
                      <td className="px-3.5 py-2.5">
                        <Link
                          href={`/crm/quotations/${q.id}`}
                          className="font-mono font-semibold text-[#1C1B1A] hover:text-[#9E4300] transition-colors"
                        >
                          {q.quotation_number}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">{formatCurrency(q.total)}</td>
                      <td className="px-3.5 py-2.5">
                        <span className="inline-flex items-center rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] uppercase text-[#4A4640]">
                          {q.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[#4A4640]">{formatDate(q.created_at)}</td>
                    </tr>
                  )
                )}
                {quoteRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3.5 py-6 text-center text-[#7C766F]">
                      No quotations generated yet for this requirement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'activities' && (
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
            <h3 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">Activity Log</h3>
          </div>
          <div className="space-y-3 text-xs">
            {activities?.map(
              (act: {
                id: string
                type?: string | null
                notes?: string | null
                created_at?: string
                created_by_profile?: { full_name?: string | null } | null
              }) => (
                <div key={act.id} className="p-3.5 bg-[#F6F3EC] rounded-none border border-[#CCC5BD]">
                  <div className="flex justify-between font-bold text-xs mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#9E4300]">{act.type}</span>
                    <span className="font-mono text-[#7C766F] font-normal">{formatDate(act.created_at)}</span>
                  </div>
                  <p className="text-[#1C1B1A] text-xs">{act.notes}</p>
                  <p className="text-[11px] text-[#7C766F] mt-1.5">
                    Logged by <span className="text-[#1C1B1A] font-medium">{act.created_by_profile?.full_name || 'Team'}</span>
                  </p>
                </div>
              )
            )}
            {(!activities || activities.length === 0) && (
              <p className="text-[#7C766F] text-center py-4">No activities logged yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
