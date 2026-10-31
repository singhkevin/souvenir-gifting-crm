import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuoteResponse } from '@/components/business/quote-response'
import { RequoteButton } from '@/components/business/requote-button'
import { markBusinessQuotationViewed } from '@/app/business/actions'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import type { CartItem } from '@/lib/catalogue/cart'
import { ProductThumb } from '@/components/ui/product-thumb'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { company, profile } = await requireBusiness(`/business/quotes/${id}`)
  await markBusinessQuotationViewed(id)
  const supabase = await createClient()
  const { data: quote } = await supabase
    .from('quotations')
    .select('id, quotation_number, status, valid_until, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total, notes, company_id, client_comment')
    .eq('id', id)
    .maybeSingle()
  if (!quote || quote.company_id !== (company?.id || profile.company_id)) notFound()
  if (quote.status === 'draft') notFound()

  const { data: items } = await supabase
    .from('quotation_items')
    .select('id, description, quantity, unit_price, line_total, client_response, product:products(id, name, sku, image_url, moq)')
    .eq('quotation_id', id)

  const open = quote.status === 'sent' || quote.status === 'viewed'
  const expired = quote.status === 'expired' || (quote.valid_until && new Date(quote.valid_until) < new Date(new Date().toDateString()) && open)
  const lines = items || []
  const requoteLines: CartItem[] = lines.map((item) => {
    const product = oneRelation(item.product as { id?: string; name?: string; sku?: string; image_url?: string | null; moq?: number | null } | null)
    return {
      id: product?.id || item.id,
      sku: product?.sku || '',
      name: product?.name || item.description || 'Item',
      price: null,
      image_url: product?.image_url || null,
      quantity: Number(item.quantity) || 1,
      maxQuantity: null,
      surface: 'business',
      catalogId: null,
      moq: product?.moq || 1,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/business/quotes"
          className="inline-flex items-center gap-1.5 sv2-label text-[10px] text-[#7C766F] hover:text-[#9E4300] transition-colors"
        >
          ← Back to quotes
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="sv2-label text-[10px] text-[#7C766F] uppercase tracking-wider">Quotation</p>
            <h1 className="mt-1 sv2-headline-md text-[#1C1C18]">{quote.quotation_number}</h1>
          </div>
          <span className="inline-block px-3 py-1 sv2-label text-xs uppercase border border-[#9E4300] bg-[#FFDBCC] text-[#783100]">
            {quote.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 sv2-mono-sm text-xs text-[#4A4640]">
          <span>Valid until: {quote.valid_until ? formatDate(quote.valid_until) : '—'}</span>
          <span>·</span>
          <span>Total: {formatCurrency(quote.total)} incl. GST</span>
        </div>
        <p className="mt-1 text-xs text-[#7C766F]">
          Line amounts are ex-GST. GST ({quote.tax_percent || 0}%) is added once.
        </p>
      </div>

      {quote.notes ? (
        <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-xs text-[#4A4640]">
          <span className="sv2-label text-[10px] text-[#7C766F] block mb-1">Notes:</span>
          {quote.notes}
        </div>
      ) : null}

      {quote.client_comment ? (
        <div className="border border-[#CCC5BD] bg-[#F6F3EC] p-4 text-xs text-[#4A4640]">
          <span className="sv2-label text-[10px] text-[#7C766F] block mb-1">Client response comment:</span>
          {quote.client_comment}
        </div>
      ) : null}

      <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
        <table className="w-full text-left text-sm border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Item</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Quantity</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Unit Price (ex-GST)</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F] text-right">Line Total (ex-GST)</th>
              <th className="p-3.5 sv2-label text-[10px] text-[#7C766F]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD]">
            {lines.map((item) => {
              const product = oneRelation(item.product as { name?: string; sku?: string; image_url?: string | null } | null)
              return (
                <tr key={item.id} className="hover:bg-[#F6F3EC] transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <ProductThumb src={product?.image_url} alt={product?.name || 'Item'} />
                      <div className="min-w-0">
                        <p className="font-medium text-[#1C1C18]">{product?.name || item.description}</p>
                        {product?.sku ? (
                          <p className="sv2-mono-sm text-xs text-[#7C766F]">SKU: {product.sku}</p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {item.quantity}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right text-xs text-[#1C1C18]">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="p-3.5 sv2-mono-sm text-right font-medium text-[#1C1C18]">
                    {formatCurrency(item.line_total)}
                  </td>
                  <td className="p-3.5">
                    {item.client_response ? (
                      <span className="inline-block px-2 py-0.5 sv2-label text-[10px] border border-[#CCC5BD] bg-[#F6F3EC] uppercase text-[#4A4640]">
                        {item.client_response}
                      </span>
                    ) : (
                      <span className="text-xs text-[#7C766F]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-sm border border-[#CCC5BD] bg-[#F6F3EC] p-4 space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">Subtotal ex-GST</span>
          <span className="sv2-mono-sm">{formatCurrency(quote.subtotal)}</span>
        </div>
        {Number(quote.discount_amount) > 0 ? (
          <div className="flex justify-between items-center text-[#BA1A1A]">
            <span className="sv2-label text-[10px] text-[#BA1A1A]">Discount ({quote.discount_percent}%) once</span>
            <span className="sv2-mono-sm">-{formatCurrency(quote.discount_amount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between items-center">
          <span className="sv2-label text-[10px] text-[#7C766F]">GST ({quote.tax_percent || 0}%) once</span>
          <span className="sv2-mono-sm">{formatCurrency(quote.tax_amount)}</span>
        </div>
        <div className="flex justify-between items-center font-bold border-t border-[#CCC5BD] pt-2 text-[#1C1C18]">
          <span className="sv2-label text-xs uppercase">Total incl. GST</span>
          <span className="sv2-mono-md text-base">{formatCurrency(quote.total)}</span>
        </div>
        <p className="text-xs text-[#7C766F] pt-1">
          Valid until {quote.valid_until ? formatDate(quote.valid_until) : '—'}.
        </p>
      </div>

      {open && !expired ? (
        <QuoteResponse
          quotationId={quote.id}
          items={lines.map((item) => {
            const product = oneRelation(item.product as { name?: string; image_url?: string | null } | null)
            return { id: item.id, name: product?.name || item.description || 'Item', imageUrl: product?.image_url || null }
          })}
        />
      ) : null}

      {quote.status === 'accepted' ? (
        <div className="border border-[#3A4537] bg-[#DAE6D3] p-4 text-sm text-[#3A4537]">
          Accepted. {company?.business_verification === 'verified'
            ? 'Use the checkout link from the acceptance confirmation, or ask the team to resend it.'
            : "We'll verify your account before checkout."}
        </div>
      ) : null}

      {quote.status === 'expired' || expired ? <RequoteButton lines={requoteLines} /> : null}
    </div>
  )
}
