import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { updateQuotationStatus, convertToOrder, duplicateQuotation, createQuotationRevision, markQuotationSentOffline } from '../actions'
import { ActionButton } from '@/components/ui/action-button'
import { QuotationCosting } from './QuotationCosting'
import { QuotationDraftEditor } from './QuotationDraftEditor'
import { QuoteContactPicker } from './QuoteContactPicker'
import { SendQuoteDialog } from './SendQuoteDialog'
import { offersByProduct, pickBestOffer } from '@/lib/pricing/offers'
import { getPricingSettings, loadSupplierOffers } from '@/lib/pricing/server'
import { absoluteClientQuoteUrl } from '@/lib/quotes/client-link'
import { defaultQuoteRecipientKey, quoteSendRecipients, sendQuoteWarnings } from '@/lib/quotes/flow'
import { requestOrigin } from '@/lib/auth/request-origin'
import { FileText, CheckCircle2, XCircle, Copy, ArrowRight } from 'lucide-react'

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const profile = await requireStaff()
  const canPrice = ['admin', 'sales', 'management', 'accounts'].includes(profile.role)
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotations')
    .select(`
      *,
      company:companies(id, name, account_type, portal_slug),
      contact:contacts(id, full_name, email),
      requirement:requirements(id, name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!quote) notFound()

  const parentQuote = quote.revision_of
    ? await supabase.from('quotations').select('quotation_number').eq('id', quote.revision_of).maybeSingle()
    : { data: null }

  const company = oneRelation(quote.company)
  const contact = oneRelation(quote.contact)
  const requirement = oneRelation(quote.requirement)

  const [{ data: items }, { data: linkedOrder }, { data: contacts }, { data: companyUsers }] = await Promise.all([
    supabase.from('quotation_items').select('*, product:products(id, name, sku, image_url, moq)').eq('quotation_id', quote.id),
    supabase.from('orders').select('id, order_number').eq('quotation_id', quote.id).maybeSingle(),
    supabase.from('contacts').select('id, full_name, email').eq('company_id', quote.company_id).order('full_name'),
    supabase.from('profiles').select('id, full_name, email, role').eq('company_id', quote.company_id).eq('is_active', true).in('role', ['client_admin', 'client_user', 'business_user']),
  ])

  const quoteItems = (items || []) as {
    id: string
    product_id?: string | null
    quantity: number
    unit_price: number
    line_total: number
    description?: string | null
    product?: { name?: string; sku?: string; moq?: number | null } | { name?: string; sku?: string; moq?: number | null }[] | null
  }[]
  const productIds = [...new Set(quoteItems.map((item) => item.product_id).filter((id): id is string => Boolean(id)))]
  const pricing = canPrice ? await getPricingSettings() : null
  const supplierOffers = canPrice && productIds.length ? await loadSupplierOffers(supabase, productIds) : []
  const groupedOffers = offersByProduct(supplierOffers)
  const bestByItem: Record<string, string | null> = {}
  for (const item of quoteItems) {
    const best = item.product_id
      ? pickBestOffer(groupedOffers.get(item.product_id) || [], {
          quantity: Number(item.quantity) || null,
          requireInStock: pricing?.requireInStock ?? true,
        })
      : null
    bestByItem[item.id] = best?.id || null
  }
  const catalogCostResult = canPrice && productIds.length
    ? await supabase.from('product_costs').select('product_id, supplier_cost').in('product_id', productIds)
    : { data: [] as { product_id: string; supplier_cost: number | null }[] }
  const catalogCostByProduct = new Map(
    (catalogCostResult.data || []).map((row) => [row.product_id, row.supplier_cost == null ? null : Number(row.supplier_cost)]),
  )
  const costResult = canPrice && quoteItems.length
    ? await supabase
        .from('quotation_item_costs')
        .select('quotation_item_id, supplier_offer_id, supplier_cost, margin_percent')
        .in('quotation_item_id', quoteItems.map((item) => item.id))
    : { data: [], error: null }
  const savedCosts = costResult.error ? [] : (costResult.data || [])

  const isExpired =
    quote.valid_until &&
    new Date(quote.valid_until) < new Date() &&
    ['sent', 'viewed'].includes(quote.status || '')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/crm/quotations" label="Back to Quotations" />

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#624B32]/10 text-[#624B32] rounded-lg">
              <FileText size={16} />
            </span>
            <span className="font-mono text-xs font-bold text-gray-500">{quote.quotation_number}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
              quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
              quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
              quote.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {quote.status}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quotation for {company?.name || 'Client'}
          </h1>
          {requirement && (
            <p className="text-xs text-gray-500 mt-0.5">
              Requirement: <span className="font-medium text-gray-700">{requirement.name}</span>
            </p>
          )}
          {quote.revision_of ? (
            <p className="text-xs text-gray-500 mt-1">
              Revision of {parentQuote.data?.quotation_number || 'a previous quotation'}
            </p>
          ) : null}
          {quote.revision_requested_at ? (
            <p className="mt-2 text-xs font-semibold text-amber-800">Revision requested{quote.client_comment ? `: ${quote.client_comment}` : ''}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'draft' && (
            <>
              <SendQuoteDialog
                quotationId={quote.id}
                total={Number(quote.total) || 0}
                validUntil={quote.valid_until}
                clientUrl={absoluteClientQuoteUrl({
                  accountType: company?.account_type,
                  portalSlug: company?.portal_slug,
                  quotationId: quote.id,
                  origin: await requestOrigin(),
                })}
                recipients={quoteSendRecipients({
                  contacts: contacts || [],
                  users: companyUsers || [],
                })}
                defaultRecipientKey={defaultQuoteRecipientKey({
                  contactId: quote.contact_id,
                  recipients: quoteSendRecipients({ contacts: contacts || [], users: companyUsers || [] }),
                })}
                warnings={sendQuoteWarnings(quoteItems.map((item) => {
                  const product = oneRelation(item.product)
                  const saved = savedCosts.find((row) => row.quotation_item_id === item.id)
                  const catalogCost = item.product_id ? catalogCostByProduct.get(item.product_id) ?? null : null
                  return {
                    name: product?.name || 'Item',
                    unitPrice: Number(item.unit_price) || 0,
                    cost: saved?.supplier_cost == null ? catalogCost : Number(saved.supplier_cost),
                    applied: Boolean(saved),
                  }
                }))}
              />
              <ActionButton
                action={markQuotationSentOffline.bind(null, quote.id)}
                pendingLabel="Marking…"
                successMessage="Marked as sent"
                title="Records the quotation as sent without emailing the client"
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors"
              >
                Mark sent (offline)
              </ActionButton>
            </>
          )}
          <Link
            href={`/crm/quotations/${quote.id}/preview`}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Preview as client
          </Link>
          {quote.revision_requested_at && ['sent', 'viewed', 'draft'].includes(quote.status || '') ? (
            <ActionButton
              action={createQuotationRevision.bind(null, quote.id)}
              pendingLabel="Creating…"
              className="px-3 py-1.5 bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold"
            >
              Create revision
            </ActionButton>
          ) : null}
          {['sent', 'viewed'].includes(quote.status || '') && !isExpired && (
            <>
              <ActionButton
                action={updateQuotationStatus.bind(null, quote.id, 'accepted')}
                pendingLabel="Accepting…"
                successMessage="Quotation accepted"
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1"
              >
                <CheckCircle2 size={13} /> Accept
              </ActionButton>
              <ActionButton
                action={updateQuotationStatus.bind(null, quote.id, 'rejected')}
                pendingLabel="Rejecting…"
                successMessage="Quotation rejected"
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
              >
                <XCircle size={13} /> Reject
              </ActionButton>
              <ActionButton
                action={duplicateQuotation.bind(null, quote.id)}
                pendingLabel="Duplicating…"
                successMessage="Quotation duplicated"
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
              >
                <Copy size={13} /> Duplicate
              </ActionButton>
            </>
          )}
          {quote.status === 'accepted' && !linkedOrder && (
            <ActionButton
              action={convertToOrder.bind(null, quote.id)}
              pendingLabel="Converting…"
              className="px-4 py-2 bg-[#624B32] hover:bg-[#704812] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowRight size={14} /> Convert to Order
            </ActionButton>
          )}
          {linkedOrder && (
            <Link
              href={`/crm/orders/${linkedOrder.id}`}
              className="px-4 py-2 bg-[#806A50] hover:opacity-90 hover:text-[#FFFFFF] text-[#FFFFFF] rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
            >
              <ArrowRight size={14} /> View order {linkedOrder.order_number}
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 text-xs space-y-2.5">
          <h3 className="font-bold text-gray-900 pb-2 border-b">Client Details</h3>
          <div><span className="text-gray-500 w-20 inline-block">Company:</span> <span className="font-semibold text-gray-900">{company?.name}</span></div>
          <div>
            <span className="text-gray-500 w-20 inline-block">Contact:</span>
            {contact?.full_name ? contact.full_name : (
              <QuoteContactPicker quotationId={quote.id} contacts={contacts || []} />
            )}
          </div>
          <div><span className="text-gray-500 w-20 inline-block">Email:</span> {contact?.email || '?'}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 text-xs space-y-2.5">
          <h3 className="font-bold text-gray-900 pb-2 border-b">Quote Timeline</h3>
          <div><span className="text-gray-500 w-20 inline-block">Issued:</span> {formatDate(quote.created_at)}</div>
          <div>
            <span className="text-gray-500 w-20 inline-block">Valid Until:</span> 
            <span className={isExpired ? 'text-red-600 font-bold' : ''}>
              {quote.valid_until ? formatDate(quote.valid_until) : '?'}
              {isExpired && ' (Expired)'}
            </span>
          </div>
          {quote.responded_at && (
            <div>
              <span className="text-gray-500 w-20 inline-block">Responded:</span>{' '}
              {formatDate(quote.responded_at)}
            </div>
          )}
          {quote.client_comment && (
            <div className="pt-1 text-gray-600">
              <span className="text-gray-500">Client note:</span> {quote.client_comment}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {quote.status === 'draft' && (
          <QuotationDraftEditor
            quotationId={quote.id}
            discountPercent={Number(quote.discount_percent) || 0}
            taxPercent={quote.tax_percent == null ? null : Number(quote.tax_percent)}
            validUntil={quote.valid_until}
            notes={quote.notes}
            lines={quoteItems.map((item) => {
              const product = oneRelation(item.product)
              return {
                id: item.id,
                name: product?.name || item.description || 'Item',
                sku: product?.sku || null,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unit_price) || 0,
                lineTotal: Number(item.line_total) || 0,
                moq: Number(product?.moq) || 1,
              }
            })}
          />
        )}
        {quote.status !== 'draft' && (
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3.5 font-semibold text-gray-500">Item</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Qty</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Unit Price</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Ex-GST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; client_response?: string | null; product?: { name?: string; sku?: string } | { name?: string; sku?: string }[] | null }) => {
              const product = oneRelation(item.product)
              return (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="p-3.5">
                  <div className="font-bold text-gray-900">{product?.name || 'Item'}</div>
                  <div className="text-gray-400 font-mono text-[10px]">{product?.sku}</div>
                  {item.client_response && (
                    <div className={`text-[10px] font-semibold uppercase ${item.client_response === 'accepted' ? 'text-emerald-700' : 'text-gray-500'}`}>
                      {item.client_response === 'accepted' ? 'Client accepted' : 'Client declined'}
                    </div>
                  )}
                </td>
                <td className="p-3.5 text-right font-medium">{item.quantity}</td>
                <td className="p-3.5 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="p-3.5 text-right font-bold text-gray-900">{formatCurrency(item.line_total)}</td>
              </tr>
              )
            })}
            {(!items || items.length === 0) && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">No line items in this quotation.</td></tr>
            )}
          </tbody>
        </table>
        )}

        <div className="bg-gray-50 p-5 border-t border-gray-200 flex flex-col items-end space-y-1.5 text-xs">
          <div className="flex justify-between w-60 text-gray-600">
            <span>Subtotal ex-GST:</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
          {Number(quote.discount_amount) > 0 && (
            <div className="flex justify-between w-60 text-green-600 font-medium">
              <span>Discount ({quote.discount_percent}%):</span>
              <span>-{formatCurrency(quote.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between w-60 text-gray-600">
            <span>GST ({quote.tax_percent || 0}%):</span>
            <span>{formatCurrency(quote.tax_amount)}</span>
          </div>
          <div className="flex justify-between w-60 text-sm font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">
            <span>Total incl. GST:</span>
            <span className="text-[#624B32]">{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>

      {canPrice && quoteItems.length > 0 && (
        <QuotationCosting
          quotationId={quote.id}
          editable={quote.status === 'draft'}
          lines={quoteItems.map((item) => {
            const product = oneRelation(item.product)
            return {
              id: item.id,
              productId: item.product_id || null,
              name: product?.name || 'Item',
              sku: product?.sku || null,
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unit_price) || 0,
              catalogCost: item.product_id ? catalogCostByProduct.get(item.product_id) ?? null : null,
            }
          })}
          offers={supplierOffers}
          saved={savedCosts.map((row) => ({
            quotation_item_id: row.quotation_item_id,
            supplier_offer_id: row.supplier_offer_id,
            supplier_cost: row.supplier_cost == null ? null : Number(row.supplier_cost),
            margin_percent: row.margin_percent == null ? null : Number(row.margin_percent),
          }))}
          bestByItem={bestByItem}
          defaultMargin={Number(pricing?.b2b_margin_percent ?? pricing?.default_margin_percent ?? 35)}
        />
      )}
    </div>
  )
}
