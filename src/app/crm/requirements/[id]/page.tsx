import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid } from '@/lib/utils'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import { requireStaff } from '@/lib/auth'
import {
  updateRequirementForm,
  removeRequirement,
  addProductToRequirement,
  removeProductFromRequirement,
  updateRequirementProductQty,
  createQuotationFromRequirement,
} from '../actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { asFormAction } from '@/lib/form-action'
import { ActionForm } from '@/components/ui/action-form'
import { MobileSheetSelect, SheetDateField } from '@/components/ui/mobile-filter-sheet'

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
    supabase.from('products').select('id, name, sku, price, status').eq('status', 'active').order('name'),
  ])

  if (!req) notFound()

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
        <div className="p-3 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200">
          This requirement cannot be permanently deleted because it has quotations or orders. It was
          closed instead.
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-[#624B32]/10 text-[#624B32] rounded-lg">
                <ClipboardList size={16} />
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Client Brief
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 capitalize">
                {req.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{req.name}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Company:{' '}
              <Link
                href={`/crm/companies/${(req.company as { id?: string })?.id}`}
                className="font-semibold text-[#624B32] hover:underline"
              >
                {(req.company as { name?: string })?.name}
              </Link>
              {' · '}
              Owner:{' '}
              <span className="font-medium text-gray-700">
                {(req.owner as { full_name?: string | null })?.full_name || 'Unassigned'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 bg-[#FAF7F2] p-4 rounded-xl border border-[#E8DFD3]">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Total Budget</p>
                <p className="text-xl font-bold text-[#624B32]">{formatCurrency(req.budget)}</p>
              </div>
              <div className="border-l border-[#E8DFD3] pl-4">
                <p className="text-[10px] uppercase font-bold text-gray-400">Target Qty</p>
                <p className="text-xl font-bold text-gray-900">{req.quantity || '—'} units</p>
              </div>
            </div>
            <ConfirmAction
              title="Remove requirement?"
              confirmLabel="Delete"
              action={asFormAction(removeRequirement)}
              hiddenFields={{ id: req.id }}
              description={
                <p>
                  Requirement: <span className="font-semibold">{req.name}</span>. If quotations or
                  orders exist it will be closed instead of deleted.
                </p>
              }
            >
              Delete
            </ConfirmAction>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
            <span
              className={`px-2.5 py-1 rounded-full ${
                hasProducts ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              1. Products{hasProducts ? ` (${productRows.length})` : ''}
            </span>
            <span className="text-gray-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full ${
                hasQuotes ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              2. Quotation{hasQuotes ? ` (${quoteRows.length})` : ''}
            </span>
            <span className="text-gray-300">→</span>
            <span
              className={`px-2.5 py-1 rounded-full ${
                hasOrder ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-gray-500 border border-gray-200'
              }`}
            >
              3. Order / fulfilment
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {!hasProducts && (
              <Link
                href={`?tab=products`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#806A50] px-3 py-2 text-xs font-semibold text-white hover:bg-[#624b32]"
              >
                <Plus size={14} /> Add products
              </Link>
            )}
            {hasProducts && !hasQuotes && (
              <ActionForm action={createQuotationFromRequirement} className="inline">
                <input type="hidden" name="requirement_id" value={req.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-[#806A50] px-3 py-2 text-xs font-semibold text-white hover:bg-[#624b32]"
                >
                  Create quotation
                </button>
              </ActionForm>
            )}
            {hasQuotes && latestQuote && (
              <Link
                href={`/crm/quotations/${latestQuote.id}`}
                className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Open latest quotation
              </Link>
            )}
            {acceptedQuote && !hasOrder && (
              <Link
                href={`/crm/quotations/${acceptedQuote.id}`}
                className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Open quotation to convert
              </Link>
            )}
            {order && (
              <Link
                href={`/crm/orders/${order.id}`}
                className="inline-flex items-center rounded-lg border border-[#806A50]/30 bg-[#806A50]/10 px-3 py-2 text-xs font-semibold text-[#624B32] hover:bg-[#806A50]/15"
              >
                View order {order.order_number || ''}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          {['overview', 'products', 'quotations', 'activities'].map((t) => (
            <Link
              key={t}
              href={`?tab=${t}`}
              className={`pb-3 text-xs font-semibold capitalize transition-colors border-b-2 ${
                tab === t
                  ? 'border-[#624B32] text-[#624B32]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
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
            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-xs space-y-3">
              <h3 className="font-bold text-sm text-gray-900 pb-2 border-b">
                Brief Description & Objectives
              </h3>
              <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                {req.description || 'No detailed description provided.'}
              </p>
              <form
                action={asFormAction(updateRequirementForm)}
                className="grid md:grid-cols-2 gap-3 pt-3 border-t"
              >
                <input type="hidden" name="id" value={req.id} />
                <input
                  name="name"
                  required
                  defaultValue={req.name}
                  className="border rounded-lg px-2 py-2 md:col-span-2"
                />
                <input
                  name="quantity"
                  type="number"
                  min="1"
                  defaultValue={req.quantity || 1}
                  className="border rounded-lg px-2 py-2"
                />
                <input
                  name="budget"
                  type="number"
                  step="0.01"
                  defaultValue={req.budget || ''}
                  placeholder="Budget"
                  className="border rounded-lg px-2 py-2"
                />
                <input
                  name="purpose"
                  defaultValue={req.purpose || ''}
                  placeholder="Purpose"
                  className="border rounded-lg px-2 py-2"
                />
                <input
                  name="delivery_city"
                  defaultValue={req.delivery_city || ''}
                  placeholder="Delivery city"
                  className="border rounded-lg px-2 py-2"
                />
                <input
                  name="payment_terms"
                  defaultValue={req.payment_terms || ''}
                  placeholder="Payment terms"
                  className="min-h-11 rounded-lg border px-2 py-2"
                />
                <SheetDateField name="deadline" label="Deadline" defaultValue={req.deadline || ''} />
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
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={req.description || ''}
                  className="rounded-lg border px-2 py-2 md:col-span-2"
                />
                <button className="min-h-11 rounded-lg bg-[#806A50] px-3 py-2 font-semibold text-[#FFFFFF] md:col-span-2">
                  Save requirement
                </button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-xs space-y-3">
              <h3 className="font-bold text-sm text-gray-900 pb-2 border-b">
                Delivery & Commercial Terms
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-500 block mb-0.5">Purpose / Occasion:</span>{' '}
                  <span className="font-semibold text-gray-900">{req.purpose || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Delivery City:</span>{' '}
                  <span className="font-semibold text-gray-900">{req.delivery_city || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Payment Terms:</span>{' '}
                  <span className="font-semibold text-gray-900">
                    {req.payment_terms || 'Standard'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Target Deadline:</span>{' '}
                  <span className="font-semibold text-red-600">{formatDate(req.deadline)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-gray-200 text-xs space-y-3">
              <h3 className="font-bold text-sm text-gray-900 pb-2 border-b">Contact Person</h3>
              <div>
                <span className="text-gray-500 block mb-0.5">Name:</span>{' '}
                <span className="font-semibold text-gray-900">
                  {(req.contact as { full_name?: string | null })?.full_name || '—'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Email:</span>{' '}
                {(req.contact as { email?: string | null })?.email || '—'}
              </div>
              <div>
                <span className="text-gray-500 block mb-0.5">Phone:</span>{' '}
                {(req.contact as { phone?: string | null })?.phone || '—'}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200">
            {assignableProducts.length > 0 ? (
              <form
                action={asFormAction(addProductToRequirement)}
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
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    Qty
                  </span>
                  <input
                    name="quantity"
                    type="number"
                    min="1"
                    defaultValue={req.quantity || 1}
                    className="mt-1 min-h-11 w-full rounded-lg border px-2 py-2 text-xs"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-1 rounded-lg bg-[#806A50] px-4 text-xs font-semibold text-white hover:bg-[#624b32]"
                >
                  <Plus size={14} /> Add product
                </button>
              </form>
            ) : (
              <p className="text-xs text-gray-500">
                {catalogueProducts?.length
                  ? 'All active catalogue products are already on this brief.'
                  : 'No active catalogue products available to add.'}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3.5 font-semibold text-gray-500">Product</th>
                  <th className="p-3.5 font-semibold text-gray-500">Qty</th>
                  <th className="p-3.5 font-semibold text-gray-500 text-right">Price</th>
                  <th className="p-3.5 font-semibold text-gray-500 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {productRows.map(
                  (item: {
                    id: string
                    quantity?: number | null
                    product?: {
                      id?: string
                      name?: string
                      sku?: string
                      price?: number | null
                    } | null
                  }) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="p-3.5">
                        <Link
                          href={`/crm/products/${item.product?.id}`}
                          className="font-bold text-gray-900 hover:text-[#624B32]"
                        >
                          {item.product?.name || 'Product'}
                        </Link>
                        <div className="text-gray-400 font-mono text-[10px]">
                          {item.product?.sku}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <form
                          action={asFormAction(updateRequirementProductQty)}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="requirement_id" value={req.id} />
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={item.quantity || 1}
                            className="w-20 rounded-lg border px-2 py-1.5"
                          />
                          <button
                            type="submit"
                            className="text-[10px] font-semibold text-[#806A50] hover:underline"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                      <td className="p-3.5 text-right font-bold text-gray-900">
                        {formatCurrency(item.product?.price)}
                      </td>
                      <td className="p-3.5 text-right">
                        <form action={asFormAction(removeProductFromRequirement)} className="inline">
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="requirement_id" value={req.id} />
                          <button
                            type="submit"
                            className="inline-flex p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove product"
                          >
                            <Trash2 size={14} />
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                )}
                {productRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
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
          <div className="bg-white p-4 rounded-2xl border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-gray-500">
              {hasProducts
                ? 'Generate a draft quotation from the products on this brief.'
                : 'Add products on the Products tab before creating a quotation.'}
            </p>
            {hasProducts ? (
              <ActionForm action={createQuotationFromRequirement} className="inline">
                <input type="hidden" name="requirement_id" value={req.id} />
                <button
                  type="submit"
                  className="inline-flex items-center rounded-lg bg-[#806A50] px-3 py-2 text-xs font-semibold text-white hover:bg-[#624b32]"
                >
                  Create quotation
                </button>
              </ActionForm>
            ) : (
              <Link
                href="?tab=products"
                className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Go to products
              </Link>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3.5 font-semibold text-gray-500">Quote #</th>
                  <th className="p-3.5 font-semibold text-gray-500">Total</th>
                  <th className="p-3.5 font-semibold text-gray-500">Status</th>
                  <th className="p-3.5 font-semibold text-gray-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quoteRows.map(
                  (q: {
                    id: string
                    quotation_number?: string | null
                    total?: number | null
                    status?: string | null
                    created_at?: string
                  }) => (
                    <tr key={q.id} className="hover:bg-gray-50/50">
                      <td className="p-3.5">
                        <Link
                          href={`/crm/quotations/${q.id}`}
                          className="font-bold text-[#624B32] hover:underline"
                        >
                          {q.quotation_number}
                        </Link>
                      </td>
                      <td className="p-3.5 font-bold text-gray-900">{formatCurrency(q.total)}</td>
                      <td className="p-3.5 capitalize">{q.status}</td>
                      <td className="p-3.5 text-gray-500">{formatDate(q.created_at)}</td>
                    </tr>
                  )
                )}
                {quoteRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
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
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="space-y-3 text-xs">
            {activities?.map(
              (act: {
                id: string
                type?: string | null
                notes?: string | null
                created_at?: string
                created_by_profile?: { full_name?: string | null } | null
              }) => (
                <div key={act.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex justify-between font-bold text-gray-900 mb-1">
                    <span className="uppercase text-[#624B32]">{act.type}</span>
                    <span className="text-gray-400 font-normal">{formatDate(act.created_at)}</span>
                  </div>
                  <p className="text-gray-700">{act.notes}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Logged by {act.created_by_profile?.full_name || 'Team'}
                  </p>
                </div>
              )
            )}
            {(!activities || activities.length === 0) && (
              <p className="text-gray-400 text-center py-4">No activities logged yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
