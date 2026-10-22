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
import { CheckCircle2, XCircle, Copy, ArrowRight } from 'lucide-react'
import { listCatalogPickerProducts } from '@/lib/catalogs/picker-products'
import { ProductImage } from '@/components/ui/product-image'

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
  const pickerProducts = quote.status === 'draft' ? await listCatalogPickerProducts(quote.company_id) : []

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
    product?: { name?: string; sku?: string; image_url?: string | null; moq?: number | null } | { name?: string; sku?: string; image_url?: string | null; moq?: number | null }[] | null
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

  const statusChip = (() => {
    switch (quote.status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#DAE6D3] text-[#3A4537] border border-[#3A4537]/20 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3A4537]" />
            {quote.status}
          </span>
        )
      case 'sent':
      case 'viewed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FFB690]/30 text-[#9E4300] border border-[#9E4300]/30 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#9E4300]" />
            {quote.status}
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#FBEDEB] text-[#BA1A1A] border border-[#BA1A1A]/40 rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#BA1A1A]" />
            {quote.status}
          </span>
        )
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] bg-[#F6F3EC] text-[#4A4640] border border-[#CCC5BD] rounded-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C766F]" />
            {quote.status || 'Draft'}
          </span>
        )
    }
  })()

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <BackButton href="/crm/quotations" label="Back to Quotations" />

      {/* Header Panel */}
      <div className="bg-[#FCF9F2] p-6 border border-[#CCC5BD] rounded-none shadow-none flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="min-w-0">
          {quote.quotation_number && (
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
              <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
              <span>/</span>
              <Link href="/crm/quotations" className="hover:text-[#9E4300] transition-colors">QUOTATIONS</Link>
              <span>/</span>
              <span className="text-[#9E4300] font-semibold">{quote.quotation_number}</span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1C18]">
              Quotation for {company?.name || 'Client'}
            </h1>
            {statusChip}
          </div>
          {requirement && (
            <p className="text-xs text-[#4A4640] mt-1.5">
              Requirement: <span className="font-medium text-[#1C1C18]">{requirement.name}</span>
            </p>
          )}
          {quote.revision_of ? (
            <p className="text-xs text-[#7C766F] mt-0.5">
              Revision of <span className="font-mono">{parentQuote.data?.quotation_number || 'a previous quotation'}</span>
            </p>
          ) : null}
          {quote.revision_requested_at ? (
            <div className="mt-2 text-xs font-semibold text-[#9E4300] bg-[#FFB690]/20 border border-[#9E4300]/30 p-2 rounded-none">
              Revision requested{quote.client_comment ? `: ${quote.client_comment}` : ''}
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
                className="px-3.5 py-2 bg-transparent hover:bg-[#1C1B1A] text-[#1C1B1A] hover:text-[#FCF9F2] border border-[#1C1B1A] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none"
              >
                Mark sent (offline)
              </ActionButton>
            </>
          )}
          <Link
            href={`/crm/quotations/${quote.id}/preview`}
            className="px-3.5 py-2 bg-transparent hover:bg-[#1C1B1A] text-[#1C1B1A] hover:text-[#FCF9F2] border border-[#1C1B1A] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center"
          >
            Preview as client
          </Link>
          {quote.revision_requested_at && ['sent', 'viewed', 'draft'].includes(quote.status || '') ? (
            <ActionButton
              action={createQuotationRevision.bind(null, quote.id)}
              pendingLabel="Creating…"
              className="px-3.5 py-2 bg-[#FFB690]/20 hover:bg-[#9E4300] text-[#9E4300] hover:text-[#FCF9F2] border border-[#9E4300] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none"
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
                className="px-4 py-2 bg-[#1C1B1A] hover:bg-[#9E4300] text-[#FCF9F2] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={13} /> Accept
              </ActionButton>
              <ActionButton
                action={updateQuotationStatus.bind(null, quote.id, 'rejected')}
                pendingLabel="Rejecting…"
                successMessage="Quotation rejected"
                className="px-3.5 py-2 bg-transparent hover:bg-[#BA1A1A] text-[#BA1A1A] hover:text-[#FCF9F2] border border-[#BA1A1A]/40 rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center gap-1.5"
              >
                <XCircle size={13} /> Reject
              </ActionButton>
              <ActionButton
                action={duplicateQuotation.bind(null, quote.id)}
                pendingLabel="Duplicating…"
                successMessage="Quotation duplicated"
                className="px-3.5 py-2 bg-transparent hover:bg-[#1C1B1A] text-[#1C1B1A] hover:text-[#FCF9F2] border border-[#1C1B1A] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center gap-1.5"
              >
                <Copy size={13} /> Duplicate
              </ActionButton>
            </>
          )}
          {quote.status === 'accepted' && !linkedOrder && (
            <ActionButton
              action={convertToOrder.bind(null, quote.id)}
              pendingLabel="Converting…"
              className="px-4 py-2 bg-[#1C1B1A] hover:bg-[#9E4300] text-[#FCF9F2] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center gap-1.5"
            >
              <ArrowRight size={14} /> Convert to Order
            </ActionButton>
          )}
          {linkedOrder && (
            <Link
              href={`/crm/orders/${linkedOrder.id}`}
              className="px-4 py-2 bg-[#1C1B1A] hover:bg-[#9E4300] text-[#FCF9F2] rounded-none text-xs font-bold uppercase tracking-[0.12em] transition-colors shadow-none inline-flex items-center gap-1.5"
            >
              <ArrowRight size={14} /> View order {linkedOrder.order_number}
            </Link>
          )}
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD]">
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Client Details</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</span>
              <span className="mt-0.5 block font-medium text-[#1C1C18]">{company?.name || '—'}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Contact</span>
              <div className="mt-0.5 text-[#1C1C18]">
                {contact?.full_name ? contact.full_name : (
                  <QuoteContactPicker quotationId={quote.id} contacts={contacts || []} />
                )}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email</span>
              <span className="mt-0.5 block text-[#4A4640]">{contact?.email || '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
          <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD]">
            <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">Quote Timeline</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Issued</span>
              <span className="mt-0.5 block text-[#1C1C18]">{formatDate(quote.created_at)}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Valid Until</span>
              <span className={`mt-0.5 block ${isExpired ? 'text-[#BA1A1A] font-semibold' : 'text-[#1C1C18]'}`}>
                {quote.valid_until ? formatDate(quote.valid_until) : '—'}
                {isExpired && ' (Expired)'}
              </span>
            </div>
            {quote.responded_at && (
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Responded</span>
                <span className="mt-0.5 block text-[#1C1C18]">{formatDate(quote.responded_at)}</span>
              </div>
            )}
            {quote.client_comment && (
              <div className="sm:col-span-2">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Client Note</span>
                <span className="mt-0.5 block text-[#4A4640]">{quote.client_comment}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Panel */}
      <div className="bg-[#FCF9F2] border border-[#CCC5BD] rounded-none shadow-none overflow-hidden">
        <div className="bg-[#F6F3EC] px-4 py-2.5 border-b border-[#CCC5BD] flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-newsreader)] text-lg md:text-xl font-normal text-[#1C1C18]">
            {quote.status === 'draft' ? 'Draft Line Items & Settings' : 'Line Items'}
          </h2>
          <span className="font-mono text-xs text-[#7C766F]">{items?.length || 0} items</span>
        </div>

        {quote.status === 'draft' && (
          <QuotationDraftEditor
            quotationId={quote.id}
            discountPercent={Number(quote.discount_percent) || 0}
            taxPercent={quote.tax_percent == null ? null : Number(quote.tax_percent)}
            validUntil={quote.valid_until}
            notes={quote.notes}
            products={pickerProducts}
            lines={quoteItems.map((item) => {
              const product = oneRelation(item.product)
              return {
                id: item.id,
                name: product?.name || item.description || 'Item',
                sku: product?.sku || null,
                imageUrl: product?.image_url || null,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.unit_price) || 0,
                lineTotal: Number(item.line_total) || 0,
                moq: Number(product?.moq) || 1,
              }
            })}
          />
        )}
        {quote.status !== 'draft' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F6F3EC] border-b border-[#CCC5BD]">
                <tr>
                  <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Item</th>
                  <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Qty</th>
                  <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Unit Price</th>
                  <th className="py-2.5 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] text-right">Ex-GST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; client_response?: string | null; product?: { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null }) => {
                  const product = oneRelation(item.product)
                  return (
                    <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <ProductImage src={product?.image_url} alt={product?.name || 'Item'} size="sm" className="shrink-0 rounded-none border border-[#CCC5BD]" />
                          <div>
                            <div className="font-semibold text-sm text-[#1C1C18]">{product?.name || 'Item'}</div>
                            {product?.sku && <div className="text-[#7C766F] font-mono text-[11px]">{product.sku}</div>}
                            {item.client_response && (
                              <div className={`mt-0.5 text-[10px] font-bold uppercase tracking-wider ${item.client_response === 'accepted' ? 'text-[#3A4537]' : 'text-[#7C766F]'}`}>
                                {item.client_response === 'accepted' ? 'Client accepted' : 'Client declined'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#1C1C18]">{item.quantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#1C1C18]">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-right font-mono text-xs font-semibold text-[#1C1C18]">{formatCurrency(item.line_total)}</td>
                    </tr>
                  )
                })}
                {(!items || items.length === 0) && (
                  <tr><td colSpan={4} className="p-6 text-center text-xs text-[#7C766F]">No line items in this quotation.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-[#F6F3EC] p-4 border-t border-[#CCC5BD] flex flex-col items-end space-y-2 text-xs">
          <div className="flex justify-between w-64 text-[#4A4640]">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Subtotal ex-GST</span>
            <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(quote.subtotal)}</span>
          </div>
          {Number(quote.discount_amount) > 0 && (
            <div className="flex justify-between w-64 text-[#3A4537]">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3A4537]">Discount ({quote.discount_percent}%)</span>
              <span className="font-mono text-xs text-[#3A4537]">-{formatCurrency(quote.discount_amount)}</span>
            </div>
          )}
          <div className="flex justify-between w-64 text-[#4A4640]">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">GST ({quote.tax_percent || 0}%)</span>
            <span className="font-mono text-xs text-[#1C1C18]">{formatCurrency(quote.tax_amount)}</span>
          </div>
          <div className="flex justify-between w-64 text-sm font-semibold text-[#1C1C18] pt-2 border-t border-[#CCC5BD] mt-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1C18]">Total incl. GST</span>
            <span className="font-mono text-sm font-bold text-[#9E4300]">{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>

      {/* Internal Costing Panel */}
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
              imageUrl: product?.image_url || null,
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
