import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, isUuid, oneRelation } from '@/lib/utils'
import { recordPayment } from '../actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { Receipt, Calendar, CreditCard, Building2, CheckCircle2 } from 'lucide-react'
import { requireStaff } from '@/lib/auth'

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) notFound()
  await requireStaff(['admin', 'accounts', 'management'])
  const supabase = await createClient()

  const [{ data: invoice }, { data: payments }] = await Promise.all([
    supabase.from('invoices').select('*, company:companies(id, name), order:orders(id, order_number)').eq('id', id).maybeSingle(),
    supabase.from('payments').select('*').eq('invoice_id', id).order('payment_date', { ascending: false })
  ])

  if (!invoice) notFound()

  const company = oneRelation(invoice.company)
  const order = oneRelation(invoice.order)
  const totalPaid = payments?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const balanceDue = Number(invoice.amount) - totalPaid

  const handleRecordPayment = async (formData: FormData) => {
    'use server'
    await recordPayment(formData)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <BackButton href="/crm/invoices" label="Back to Invoices" />

      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#4A235A]/10 text-[#4A235A] rounded-lg">
              <Receipt size={16} />
            </span>
            <span className="font-mono text-xs font-bold text-gray-500">{invoice.invoice_number}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
              invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
              invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
              invoice.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
            }`}>
              {invoice.status?.replace('_', ' ')}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Invoice for {company?.name || 'Client'}
          </h1>
          {order && (
            <p className="text-xs text-gray-500 mt-0.5">
              Linked Order: <Link href={`/crm/orders/${order.id}`} className="font-semibold text-[#4A235A] hover:underline">{order.order_number}</Link>
            </p>
          )}
        </div>

        <div className="flex items-center gap-6 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400">Total Amount</p>
            <p className="text-xl font-bold text-[#4A235A]">{formatCurrency(invoice.amount)}</p>
          </div>
          <div className="border-l border-purple-200 pl-4">
            <p className="text-[10px] uppercase font-bold text-gray-400">Balance Due</p>
            <p className={`text-xl font-bold ${balanceDue > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {formatCurrency(balanceDue)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl border border-gray-200 text-xs space-y-2.5">
          <h3 className="font-bold text-gray-900 pb-2 border-b">Invoice Timeline</h3>
          <div><span className="text-gray-500 w-24 inline-block">Invoice Date:</span> {formatDate(invoice.invoice_date)}</div>
          <div><span className="text-gray-500 w-24 inline-block">Due Date:</span> <span className="font-semibold text-gray-900">{formatDate(invoice.due_date)}</span></div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 text-xs space-y-2.5">
          <h3 className="font-bold text-gray-900 pb-2 border-b">Payment Summary</h3>
          <div><span className="text-gray-500 w-24 inline-block">Amount Paid:</span> <span className="font-semibold text-green-700">{formatCurrency(totalPaid)}</span></div>
          <div><span className="text-gray-500 w-24 inline-block">Status:</span> <span className="capitalize">{invoice.status?.replace('_', ' ')}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Payments Collected</h2>
            <span className="text-xs text-gray-400">{payments?.length || 0} recorded</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-3 font-semibold text-gray-500">Date</th>
                <th className="p-3 font-semibold text-gray-500 text-right">Amount</th>
                <th className="p-3 font-semibold text-gray-500">Method</th>
                <th className="p-3 font-semibold text-gray-500">Reference / UTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments?.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50/50">
                  <td className="p-3 font-medium">{formatDate(payment.payment_date)}</td>
                  <td className="p-3 text-right font-bold text-green-700">{formatCurrency(payment.amount)}</td>
                  <td className="p-3 capitalize text-gray-600">{payment.method?.replace('_', ' ')}</td>
                  <td className="p-3 font-mono text-gray-500">{payment.reference || '?'}</td>
                </tr>
              ))}
              {(!payments || payments.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    No payments recorded for this invoice yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {balanceDue > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard size={14} className="text-[#4A235A]" /> Record Payment
            </h2>
            <form action={handleRecordPayment} className="space-y-3 text-xs">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  name="payment_date"
                  required
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg"
                />
              </div>
              
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Amount (?) *</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  max={balanceDue}
                  required
                  defaultValue={balanceDue}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Payment Method *</label>
                <select name="method" required className="w-full px-3 py-1.5 border border-gray-200 rounded-lg bg-white">
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="credit_card">Corporate Card</option>
                  <option value="cash">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Reference / UTR</label>
                <input
                  type="text"
                  name="reference"
                  placeholder="e.g. UTR12345678"
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#4A235A] hover:bg-[#3d1c4a] text-white rounded-lg font-semibold transition-colors shadow-sm mt-2"
              >
                Save Payment
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
