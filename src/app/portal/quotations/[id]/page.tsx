import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { QuotationActions } from './QuotationActions'
import { FileText, Calendar, CheckCircle2 } from 'lucide-react'

export default async function PortalQuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return redirect('/login')

  const { data: companyId } = await supabase.rpc('client_company_id')

  const { data: quote } = await supabase
    .from('quotations')
    .select(`
      *,
      items:quotation_items(
        id, quantity, unit_price, line_total, product:products(name, sku, image_url)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (!quote || quote.company_id !== companyId) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/portal/quotations" label="Back to Quotations" />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-gray-500 bg-white px-2 py-0.5 rounded border">
                {quote.quotation_number}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                quote.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                quote.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {quote.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Commercial Proposal</h1>
            <p className="text-xs text-gray-500 mt-0.5">Created on {formatDate(quote.created_at)}</p>
          </div>

          <div className="sm:text-right">
            <p className="text-[10px] uppercase font-bold text-gray-400">Total Estimate</p>
            <p className="text-2xl font-bold text-[#4A235A]">{formatCurrency(quote.total)}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Valid until: <span className="font-bold text-gray-800">{quote.valid_until ? formatDate(quote.valid_until) : '30 Days'}</span>
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-700">Itemized Quotation</h3>

            <div className="space-y-3 md:hidden">
              {quote.items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; product?: { name?: string; sku?: string } | { name?: string; sku?: string }[] | null }) => {
                const product = oneRelation(item.product)
                return (
                  <article key={item.id} className="rounded-xl border border-[#E8E4DE] bg-[#FAF7F2] p-4">
                    <p className="text-sm font-semibold text-gray-900">{product?.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-400">{product?.sku}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">Qty</p>
                        <p className="font-semibold text-gray-800">{item.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">Unit</p>
                        <p className="font-semibold text-gray-800">{formatCurrency(item.unit_price)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-gray-400">Total</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(item.line_total)}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-gray-200 md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 text-center font-semibold">Quantity</th>
                    <th className="px-4 py-3 text-right font-semibold">Unit Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {quote.items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; product?: { name?: string; sku?: string } | { name?: string; sku?: string }[] | null }) => {
                    const product = oneRelation(item.product)
                    return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{product?.name}</div>
                        <div className="font-mono text-[10px] text-gray-400">{product?.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.quantity} units</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(item.line_total)}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-gray-100">
            <div className="flex-1 text-xs">
              {quote.notes && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-gray-900 mb-1">Proposal Terms & Customisation Notes</h4>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}
            </div>
            
            <div className="w-full sm:w-64 space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(quote.subtotal)}</span>
              </div>
              {quote.discount_amount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Discount ({quote.discount_percent}%):</span>
                  <span>-{formatCurrency(quote.discount_amount)}</span>
                </div>
              )}
              {quote.tax_amount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST / Tax ({quote.tax_percent}%):</span>
                  <span>{formatCurrency(quote.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total Amount:</span>
                <span className="text-[#4A235A]">{formatCurrency(quote.total)}</span>
              </div>
            </div>
          </div>

          {quote.status === 'sent' && (
            <div className="pt-4 border-t border-gray-100">
              <QuotationActions quotationId={quote.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
