import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuoteResponse } from '@/components/business/quote-response'
import { RequoteButton } from '@/components/business/requote-button'
import { markBusinessQuotationViewed } from '@/app/business/actions'
import { requireBusiness } from '@/lib/business/session'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import type { CartItem } from '@/lib/catalogue/cart'

export const dynamic = 'force-dynamic'

export default async function BusinessQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const { company, profile } = await requireBusiness()
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
      <Link href="/business/quotes" className="text-xs uppercase tracking-[0.14em] text-[#806A50]">Quotes</Link>
      <div>
        <h1 className="font-serif text-3xl">{quote.quotation_number}</h1>
        <p className="mt-2 text-sm capitalize text-[#5C6570]">
          {quote.status} · valid until {quote.valid_until ? formatDate(quote.valid_until) : '—'} · {formatCurrency(quote.total)} incl. GST
        </p>
        <p className="mt-1 text-xs text-[#5C6570]">Line amounts are ex-GST. GST ({quote.tax_percent || 0}%) is added once.</p>
      </div>
      {quote.notes ? <p className="text-sm text-[#5C6570]">{quote.notes}</p> : null}
      {quote.client_comment ? <p className="text-sm text-[#5C6570]">{quote.client_comment}</p> : null}
      <ul className="divide-y divide-[#E8E4DE] rounded-lg border border-[#E8E4DE] bg-white">
        {lines.map((item) => {
          const product = oneRelation(item.product as { name?: string; sku?: string } | null)
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="block font-medium">{product?.name || item.description}</span>
                <span className="text-xs text-[#5C6570]">{product?.sku} · {item.quantity} × {formatCurrency(item.unit_price)}</span>
              </span>
              <span className="text-right">
                <span className="block">{formatCurrency(item.line_total)} <span className="text-[10px] text-[#5C6570]">ex-GST</span></span>
                {item.client_response ? <span className="text-xs capitalize text-[#5C6570]">{item.client_response}</span> : null}
              </span>
            </li>
          )
        })}
      </ul>
      <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal ex-GST</span><span>{formatCurrency(quote.subtotal)}</span></div>
        {Number(quote.discount_amount) > 0 ? (
          <div className="flex justify-between"><span>Discount ({quote.discount_percent}%) once</span><span>-{formatCurrency(quote.discount_amount)}</span></div>
        ) : null}
        <div className="flex justify-between"><span>GST ({quote.tax_percent || 0}%) once</span><span>{formatCurrency(quote.tax_amount)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total incl. GST</span><span>{formatCurrency(quote.total)}</span></div>
        <p className="text-xs text-[#5C6570]">Valid until {quote.valid_until ? formatDate(quote.valid_until) : '—'}.</p>
      </div>
      {open && !expired ? (
        <QuoteResponse
          quotationId={quote.id}
          items={lines.map((item) => {
            const product = oneRelation(item.product as { name?: string } | null)
            return { id: item.id, name: product?.name || item.description || 'Item' }
          })}
        />
      ) : null}
      {quote.status === 'accepted' ? (
        <p className="text-sm text-[#5C6570]">
          Accepted. {company?.business_verification === 'verified'
            ? 'Use the checkout link from the acceptance confirmation, or ask the team to resend it.'
            : "We'll verify your account before checkout."}
        </p>
      ) : null}
      {quote.status === 'expired' || expired ? <RequoteButton lines={requoteLines} /> : null}
    </div>
  )
}
