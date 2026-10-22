import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { QuotationActions } from '@/app/portal/quotations/[id]/QuotationActions'
import { ProductThumb } from '@/components/ui/product-thumb'

function QuoteStatusChip({ status }: { status: string | null }) {
  const norm = String(status || 'sent').toLowerCase()
  if (norm === 'accepted') {
    return (
      <span className="inline-block border border-[#3A4537] bg-[#DAE6D3] text-[#3A4537] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        Accepted
      </span>
    )
  }
  if (norm === 'rejected') {
    return (
      <span className="inline-block border border-[#BA1A1A] bg-[#FFDAD6] text-[#BA1A1A] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        Declined
      </span>
    )
  }
  if (norm === 'sent' || norm === 'viewed') {
    return (
      <span className="inline-block border border-[#9E4300] bg-[#FFDBCB]/40 text-[#9E4300] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
        Awaiting Decision
      </span>
    )
  }
  return (
    <span className="inline-block border border-[#CCC5BD] bg-[#F1EEE7] text-[#4A4640] px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-none">
      {norm}
    </span>
  )
}

export default async function PortalQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: companyId } = await supabase.rpc('client_company_id')

  const withResponse = await supabase
    .from('quotations')
    .select(`
      *,
      items:quotation_items(
        id, quantity, unit_price, line_total, client_response, product:products(name, sku, image_url)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  let quote = withResponse.data
  if (withResponse.error && /client_response/i.test(withResponse.error.message)) {
    const fallback = await supabase
      .from('quotations')
      .select(`
        *,
        items:quotation_items(
          id, quantity, unit_price, line_total, product:products(name, sku, image_url)
        )
      `)
      .eq('id', id)
      .maybeSingle()
    quote = fallback.data
  }

  if (!quote || quote.company_id !== companyId) {
    notFound()
  }

  const isExpired =
    Boolean(quote.valid_until) &&
    new Date(quote.valid_until) < new Date() &&
    ['sent', 'viewed'].includes(quote.status || '')
  const canRespond = ['sent', 'viewed'].includes(quote.status || '') && !isExpired

  return (
    <div className="max-w-5xl mx-auto space-y-6 min-w-0">
      {/* Navigation & Status Header */}
      <div className="flex items-center justify-between border-b border-[#CCC5BD] pb-4">
        <BackButton
          href="/portal/quotes?tab=quotes"
          label="Back to quotes"
          className="text-xs uppercase tracking-wider text-[#4A4640] hover:text-[#9E4300]"
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[#1C1C18] border border-[#CCC5BD] bg-[#F1EEE7] px-2 py-0.5 rounded-none">
            {quote.quotation_number}
          </span>
          <QuoteStatusChip status={quote.status} />
        </div>
      </div>

      {/* Main Container */}
      <div className="border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
        {/* Header Block */}
        <div className="p-6 bg-[#FCF9F2] space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                Quotation
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-[#1C1C18] tracking-tight">
                Quotation {quote.quotation_number}
              </h1>
              <p className="font-mono text-xs text-[#7C766F] mt-1">
                Issued on {formatDate(quote.created_at)}
              </p>
            </div>

            <div className="sm:text-right shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#CCC5BD]">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                Total incl. GST
              </span>
              <p className="font-mono text-2xl sm:text-3xl font-bold text-[#1C1C18]">
                {formatCurrency(quote.total)}
              </p>
              <p className="font-mono text-xs text-[#4A4640] mt-1">
                Valid until:{' '}
                <span className={isExpired ? 'text-[#BA1A1A] font-bold' : 'font-medium text-[#1C1C18]'}>
                  {quote.valid_until ? formatDate(quote.valid_until) : 'Not set'}
                  {isExpired ? ' (Expired)' : ''}
                </span>
              </p>
              <p className="text-[11px] text-[#7C766F] mt-0.5">
                GST {quote.tax_percent || 0}% is added once. Line amounts are ex-GST.
              </p>
            </div>
          </div>
        </div>

        {/* Status Callout Banners */}
        {isExpired && (
          <div className="p-4 bg-[#FFDAD6] border-b border-[#BA1A1A] text-xs text-[#BA1A1A] font-medium">
            This quote is past its validity date. Contact your account manager for a revised proposal.
          </div>
        )}
        {quote.status === 'accepted' && (
          <div className="p-4 bg-[#DAE6D3] border-b border-[#3A4537] text-xs text-[#3A4537] font-medium">
            You accepted this quote
            {quote.responded_at ? ` on ${formatDate(quote.responded_at)}` : ''}.
            {' '}The generated order includes all confirmed lines.
          </div>
        )}
        {quote.status === 'rejected' && (
          <div className="p-4 bg-[#F1EEE7] border-b border-[#CCC5BD] text-xs text-[#4A4640]">
            You declined this quote
            {quote.responded_at ? ` on ${formatDate(quote.responded_at)}` : ''}.
            {quote.client_comment ? ` Note: "${quote.client_comment}"` : ''}
          </div>
        )}

        {/* Line Items Table Section */}
        <div className="p-6 space-y-4">
          <div className="border-b border-[#CCC5BD] pb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
              Line items
            </span>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block border border-[#CCC5BD] bg-white rounded-none overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC] text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-right">Line Total (ex-GST)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {quote.items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; client_response?: string | null; product?: { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null }) => {
                  const product = oneRelation(item.product)
                  return (
                    <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-3">
                        <ProductThumb src={product?.image_url} alt={product?.name || 'Item'} />
                        <div className="min-w-0">
                        <div className="font-semibold text-[#1C1C18]">{product?.name || 'Item'}</div>
                        {product?.sku && (
                          <div className="font-mono text-[10px] text-[#7C766F] mt-0.5">
                            SKU: {product.sku}
                          </div>
                        )}
                        {item.client_response && (
                          <span className={`inline-block mt-1 px-1.5 py-0.5 text-[9px]  uppercase tracking-wider border ${
                            item.client_response === 'accepted'
                              ? 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                              : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]'
                          }`}>
                            {item.client_response}
                          </span>
                        )}
                        </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[#1C1C18]">
                        {item.quantity} units
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-[#4A4640]">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#1C1C18]">
                        {formatCurrency(item.line_total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Items */}
          <div className="md:hidden border border-[#CCC5BD] bg-white rounded-none divide-y divide-[#CCC5BD]">
            {quote.items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; client_response?: string | null; product?: { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null }) => {
              const product = oneRelation(item.product)
              return (
                <article key={item.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <ProductThumb src={product?.image_url} alt={product?.name || 'Item'} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-[#1C1C18]">{product?.name || 'Item'}</p>
                      {product?.sku && (
                        <p className="font-mono text-[10px] text-[#7C766F] mt-0.5">SKU: {product.sku}</p>
                      )}
                    </div>
                    {item.client_response && (
                      <span className={`px-2 py-0.5 text-[10px]  uppercase border ${
                        item.client_response === 'accepted'
                          ? 'border-[#3A4537] bg-[#DAE6D3] text-[#3A4537]'
                          : 'border-[#CCC5BD] bg-[#F1EEE7] text-[#7C766F]'
                      }`}>
                        {item.client_response}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-[#CCC5BD]">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Qty</span>
                      <span className="font-mono text-[#1C1C18]">{item.quantity}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Rate</span>
                      <span className="font-mono text-[#4A4640]">{formatCurrency(item.unit_price)}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Ex-GST</span>
                      <span className="font-mono font-semibold text-[#1C1C18]">{formatCurrency(item.line_total)}</span>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>

        {/* Financial Summary & Proposal Notes */}
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="flex-1 text-xs">
              {quote.notes ? (
                <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 rounded-none space-y-1">
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1C1C18]">
                    Notes
                  </h4>
                  <p className="text-[#4A4640] leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
                </div>
              ) : null}
            </div>

            <div className="w-full md:w-80 border border-[#CCC5BD] bg-[#FCF9F2] p-5 rounded-none space-y-2.5 text-xs">
              <div className="flex justify-between text-[#4A4640]">
                <span>Taxable Value (ex-GST):</span>
                <span className="font-mono font-medium text-[#1C1C18]">{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-[#9E4300] font-medium">
                  <span>Discount ({quote.discount_percent}%):</span>
                  <span className="font-mono">-{formatCurrency(quote.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#4A4640] pb-2 border-b border-[#CCC5BD]">
                <span>GST ({quote.tax_percent || 0}%):</span>
                <span className="font-mono font-medium text-[#1C1C18]">{formatCurrency(quote.tax_amount)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-bold uppercase tracking-wider text-[#1C1C18]">Total incl. GST:</span>
                <span className="font-mono text-xl font-bold text-[#1C1C18]">
                  {formatCurrency(quote.total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Component (Accept / Reject / Changes) */}
        {canRespond && (
          <div className="p-6 bg-[#FCF9F2]">
            <QuotationActions
              quotationId={quote.id}
              discountPercent={Number(quote.discount_percent) || 0}
              taxPercent={Number(quote.tax_percent) || 0}
              validUntil={quote.valid_until || null}
              items={(quote.items || []).map((item: { id: string; quantity: number; unit_price: number; line_total: number; product?: { name?: string; sku?: string; image_url?: string | null } | { name?: string; sku?: string; image_url?: string | null }[] | null }) => {
                const product = oneRelation(item.product)
                return {
                  id: item.id,
                  name: product?.name || 'Item',
                  sku: product?.sku || null,
                  imageUrl: product?.image_url || null,
                  quantity: Number(item.quantity) || 0,
                  unitPrice: Number(item.unit_price) || 0,
                  lineTotal: Number(item.line_total) || 0,
                }
              })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
