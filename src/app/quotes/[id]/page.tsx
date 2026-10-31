import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteShell } from '@/components/site/site-shell'
import { ProductThumb } from '@/components/ui/product-thumb'
import { quoteViewSecret, quoteViewTokenMatches } from '@/lib/quotes/public-link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Quotation',
}

/**
 * View-only quotation for a recipient with no portal and no business login.
 * The token is the capability. Accepting stays with staff: a forwarded email
 * must not create an order.
 */
export default async function PublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { id } = await params
  const { t: token } = await searchParams
  const secret = quoteViewSecret()
  const admin = createAdminClient()
  if (!admin || !isUuid(id) || !quoteViewTokenMatches(id, token, secret)) notFound()

  const { data: quote } = await admin
    .from('quotations')
    .select(`
      id, quotation_number, status, valid_until, subtotal, discount_percent, discount_amount,
      tax_percent, tax_amount, total, notes,
      company:companies(name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!quote) notFound()

  let status = quote.status as string | null
  if (status === 'sent') {
    const marked = await admin.from('quotations').update({ status: 'viewed' }).eq('id', id).eq('status', 'sent')
    if (!marked.error) status = 'viewed'
  }

  const { data: items } = await admin
    .from('quotation_items')
    .select('id, description, quantity, unit_price, line_total, product:products(name, sku, image_url)')
    .eq('quotation_id', id)

  const company = oneRelation(quote.company as { name?: string | null } | { name?: string | null }[] | null)
  const open = status === 'sent' || status === 'viewed'
  const expired = status === 'expired' || (Boolean(quote.valid_until) && new Date(quote.valid_until) < new Date(new Date().toDateString()) && open)
  const lines = items || []

  return (
    <SiteShell>
      <section className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-4 py-10 sm:px-8 sm:py-12 lg:px-16">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#9E4300]">Quotation</p>
          <h1 className="font-serif text-3xl font-normal text-[#1C1C18] sm:text-4xl">
            {quote.quotation_number || 'Quotation'}
          </h1>
          <p className="text-sm text-[#4A4640]">
            {company?.name ? `${company.name}. ` : ''}
            Line amounts are ex-GST. GST is added once.
          </p>
          <p className="text-sm text-[#4A4640]">
            This link only shows the quotation. It does not sign you in. Reply to the email from our team to accept or change it.
          </p>
        </div>
      </section>
      <section className="px-4 py-8 sm:px-8 lg:px-16">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="grid grid-cols-2 gap-px border border-[#CCC5BD] bg-[#CCC5BD] sm:grid-cols-3">
            <div className="bg-[#FCF9F2] p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Status</span>
              <span className="mt-1 block text-sm font-semibold capitalize text-[#1C1C18]">{expired ? 'expired' : status}</span>
            </div>
            <div className="bg-[#FCF9F2] p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Valid until</span>
              <span className="mt-1 block font-mono text-sm text-[#1C1C18]">{quote.valid_until ? formatDate(quote.valid_until) : '—'}</span>
            </div>
            <div className="col-span-2 bg-[#FCF9F2] p-4 sm:col-span-1">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7C766F]">Total incl. GST</span>
              <span className="mt-1 block font-mono text-sm font-bold text-[#1C1C18]">{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {expired ? (
            <p className="border border-[#9E4300]/30 bg-[#FFB690]/30 px-3 py-2 text-sm text-[#9E4300]">
              This quotation has expired. Reply to the email if you would like it quoted again.
            </p>
          ) : null}

          <div className="overflow-x-auto border border-[#CCC5BD] bg-[#FCF9F2]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
                <tr>
                  <th className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#7C766F]">Item</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#7C766F]">Qty</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#7C766F]">Unit ex-GST</th>
                  <th className="px-4 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-[#7C766F]">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#CCC5BD]">
                {lines.map((item) => {
                  const product = oneRelation(item.product as { name?: string | null; sku?: string | null; image_url?: string | null } | { name?: string | null; sku?: string | null; image_url?: string | null }[] | null)
                  const name = product?.name || item.description || 'Item'
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ProductThumb src={product?.image_url} alt={name} />
                          <div>
                            <div className="text-[#1C1C18]">{name}</div>
                            {product?.sku ? <div className="font-mono text-[11px] text-[#7C766F]">{product.sku}</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[#1C1C18]">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#1C1C18]">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#1C1C18]">{formatCurrency(item.line_total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm text-[#4A4640]">
            <div className="flex justify-between">
              <span>Subtotal ex-GST</span>
              <span className="font-mono text-[#1C1C18]">{formatCurrency(quote.subtotal)}</span>
            </div>
            {Number(quote.discount_amount) > 0 ? (
              <div className="flex justify-between">
                <span>Discount ({quote.discount_percent}%)</span>
                <span className="font-mono text-[#1C1C18]">-{formatCurrency(quote.discount_amount)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span>GST ({quote.tax_percent || 0}%)</span>
              <span className="font-mono text-[#1C1C18]">{formatCurrency(quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between border-t border-[#CCC5BD] pt-2 font-semibold text-[#1C1C18]">
              <span>Total incl. GST</span>
              <span className="font-mono">{formatCurrency(quote.total)}</span>
            </div>
          </div>

          {quote.notes ? <p className="whitespace-pre-wrap text-sm text-[#4A4640]">{quote.notes}</p> : null}
        </div>
      </section>
    </SiteShell>
  )
}
