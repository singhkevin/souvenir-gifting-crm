import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from './PrintButton'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'

export default async function QuotationPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  await requireStaff()
  const supabase = await createClient()
  const { data: quote } = await supabase
    .from('quotations')
    .select('id, quotation_number, status, valid_until, notes, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total, company:companies(name)')
    .eq('id', id)
    .maybeSingle()
  if (!quote) notFound()
  const { data: items } = await supabase
    .from('quotation_items')
    .select('id, quantity, unit_price, line_total, description, product:products(name, sku)')
    .eq('quotation_id', id)
  const company = oneRelation(quote.company)

  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-6">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/crm/quotations/${id}`} className="text-xs font-semibold text-[#624B32]">Back to quotation</Link>
        <PrintButton />
      </div>
      <header>
        <p className="font-mono text-xs text-gray-500">{quote.quotation_number}</p>
        <h1 className="text-2xl font-bold text-gray-900">Quotation for {company?.name || 'Client'}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Valid until {quote.valid_until ? formatDate(quote.valid_until) : '—'}. Line amounts are ex-GST. GST is added once.
        </p>
      </header>
      <table className="w-full text-left text-xs">
        <thead className="border-b text-gray-500">
          <tr>
            <th className="py-2">Item</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Unit</th>
            <th className="py-2 text-right">Ex-GST</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item) => {
            const product = oneRelation(item.product)
            return (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">
                  <div className="font-semibold text-gray-900">{product?.name || item.description || 'Item'}</div>
                  <div className="font-mono text-[10px] text-gray-400">{product?.sku}</div>
                </td>
                <td className="py-2 text-right">{item.quantity}</td>
                <td className="py-2 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(item.line_total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="ml-auto w-64 space-y-1 text-xs">
        <div className="flex justify-between"><span>Subtotal ex-GST</span><span>{formatCurrency(quote.subtotal)}</span></div>
        {Number(quote.discount_amount) > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount ({quote.discount_percent}%)</span>
            <span>-{formatCurrency(quote.discount_amount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>GST ({quote.tax_percent || 0}%)</span>
          <span>{formatCurrency(quote.tax_amount)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 text-sm font-bold">
          <span>Total incl. GST</span>
          <span>{formatCurrency(quote.total)}</span>
        </div>
      </div>
      {quote.notes ? <p className="whitespace-pre-wrap text-xs text-gray-600">{quote.notes}</p> : null}
    </div>
  )
}
