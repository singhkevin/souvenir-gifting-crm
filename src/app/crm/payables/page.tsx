import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'

export default async function PayablesPage() {
  await requireStaff(['admin', 'accounts', 'management'])
  const supabase = await createClient()

  const { data: payables } = await supabase.from('payables').select('*, orders(order_number)').order('due_date', { ascending: true })

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-6">Accounts Payable</h1>
      
      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Vendor Type</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Vendor Name</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Order #</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Amount</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Paid</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Outstanding</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Due Date</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {payables?.map(payable => {
              const outstanding = Number(payable.amount) - Number(payable.amount_paid)
              const order = oneRelation(payable.orders)
              return (
                <tr key={payable.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                  <td className="p-3 text-sm">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">{payable.vendor_type}</span>
                  </td>
                  <td className="p-3 text-sm font-medium">{payable.vendor_name || 'N/A'}</td>
                  <td className="p-3 text-sm">{order?.order_number || 'N/A'}</td>
                  <td className="p-3 text-sm">{formatCurrency(payable.amount)}</td>
                  <td className="p-3 text-sm text-green-600">{formatCurrency(payable.amount_paid)}</td>
                  <td className="p-3 text-sm font-medium">{formatCurrency(outstanding)}</td>
                  <td className={`p-3 text-sm ${payable.due_date && new Date(payable.due_date) < new Date() && payable.status !== 'paid' ? 'text-red-600' : ''}`}>
                    {formatDate(payable.due_date)}
                  </td>
                  <td className="p-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      payable.status === 'paid' ? 'bg-green-100 text-green-800' :
                      payable.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {String(payable.status || '').replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )
            })}
            {(!payables || payables.length === 0) && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-[var(--color-text-secondary)]">No payables found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}