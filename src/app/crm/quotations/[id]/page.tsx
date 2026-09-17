import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import { updateQuotationStatus, convertToOrder, duplicateQuotation } from '../actions'
import { FileText, CheckCircle2, XCircle, Copy, ArrowRight } from 'lucide-react'

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  await requireStaff()
  const supabase = await createClient()

  const { data: quote } = await supabase
    .from('quotations')
    .select(`
      *,
      company:companies(id, name),
      contact:contacts(id, full_name, email),
      requirement:requirements(id, name)
    `)
    .eq('id', id)
    .maybeSingle()

  if (!quote) notFound()

  const company = oneRelation(quote.company)
  const contact = oneRelation(quote.contact)
  const requirement = oneRelation(quote.requirement)

  const [{ data: items }, { data: linkedOrder }] = await Promise.all([
    supabase.from('quotation_items').select('*, product:products(id, name, sku, image_url)').eq('quotation_id', quote.id),
    supabase.from('orders').select('id, order_number').eq('quotation_id', quote.id).maybeSingle(),
  ])

  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date() && quote.status === 'sent'

  const markSentAction = async () => {
    'use server'
    await updateQuotationStatus(quote.id, 'sent')
  }

  const markAcceptedAction = async () => {
    'use server'
    await updateQuotationStatus(quote.id, 'accepted')
  }

  const markRejectedAction = async () => {
    'use server'
    await updateQuotationStatus(quote.id, 'rejected')
  }

  const convertAction = async () => {
    'use server'
    await convertToOrder(quote.id)
  }

  const duplicateAction = async () => {
    'use server'
    await duplicateQuotation(quote.id)
  }

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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quote.status === 'draft' && (
            <form action={markSentAction}>
              <button type="submit" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors">
                Mark as Sent
              </button>
            </form>
          )}
          {quote.status === 'sent' && (
            <>
              <form action={markAcceptedAction}>
                <button type="submit" className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1">
                  <CheckCircle2 size={13} /> Accept
                </button>
              </form>
              <form action={markRejectedAction}>
                <button type="submit" className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1">
                  <XCircle size={13} /> Reject
                </button>
              </form>
              <form action={duplicateAction}>
                <button type="submit" className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1">
                  <Copy size={13} /> Duplicate
                </button>
              </form>
            </>
          )}
          {quote.status === 'accepted' && !linkedOrder && (
            <form action={convertAction}>
              <button type="submit" className="px-4 py-2 bg-[#624B32] hover:bg-[#704812] text-white rounded-lg text-xs font-semibold shadow-sm transition-colors inline-flex items-center gap-1.5">
                <ArrowRight size={14} /> Convert to Order
              </button>
            </form>
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
          <div><span className="text-gray-500 w-20 inline-block">Contact:</span> {contact?.full_name || '?'}</div>
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
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-3.5 font-semibold text-gray-500">Item</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Qty</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Unit Price</th>
              <th className="p-3.5 font-semibold text-gray-500 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items?.map((item: { id: string; quantity: number; unit_price: number; line_total: number; product?: { name?: string; sku?: string } | { name?: string; sku?: string }[] | null }) => {
              const product = oneRelation(item.product)
              return (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="p-3.5">
                  <div className="font-bold text-gray-900">{product?.name || 'Item'}</div>
                  <div className="text-gray-400 font-mono text-[10px]">{product?.sku}</div>
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

        <div className="bg-gray-50 p-5 border-t border-gray-200 flex flex-col items-end space-y-1.5 text-xs">
          <div className="flex justify-between w-60 text-gray-600">
            <span>Subtotal:</span>
            <span>{formatCurrency(quote.subtotal)}</span>
          </div>
          {Number(quote.discount_amount) > 0 && (
            <div className="flex justify-between w-60 text-green-600 font-medium">
              <span>Discount ({quote.discount_percent}%):</span>
              <span>-{formatCurrency(quote.discount_amount)}</span>
            </div>
          )}
          {Number(quote.tax_amount) > 0 && (
            <div className="flex justify-between w-60 text-gray-600">
              <span>GST / Tax ({quote.tax_percent}%):</span>
              <span>{formatCurrency(quote.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between w-60 text-sm font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">
            <span>Total:</span>
            <span className="text-[#624B32]">{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
