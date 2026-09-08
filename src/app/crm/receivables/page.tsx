import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'

export default async function ReceivablesPage() {
  await requireStaff(['admin', 'accounts', 'management'])
  const supabase = await createClient()

  const { data: invoices } = await supabase.from('invoices').select('*, companies(name)').in('status', ['unpaid', 'issued', 'partially_paid', 'overdue']).order('due_date', { ascending: true })
  const { data: paidThisMonthInvoices } = await supabase.from('invoices').select('amount').eq('status', 'paid').gte('updated_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
  
  const outstanding = invoices?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const overdue = invoices?.filter(i => new Date(i.due_date) < new Date()).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  
  const currentMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
  const dueThisMonth = invoices?.filter(i => new Date(i.due_date) <= currentMonthEnd && new Date(i.due_date) >= new Date()).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  
  const paidThisMonth = paidThisMonthInvoices?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[var(--color-primary)]">Accounts Receivable</h1>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Total Outstanding</p>
          <p className="mt-1 break-words text-base font-semibold sm:text-xl">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Due This Month</p>
          <p className="mt-1 break-words text-base font-semibold text-blue-600 sm:text-xl">{formatCurrency(dueThisMonth)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Overdue</p>
          <p className="mt-1 break-words text-base font-semibold text-red-600 sm:text-xl">{formatCurrency(overdue)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Paid This Month</p>
          <p className="mt-1 break-words text-base font-semibold text-green-600 sm:text-xl">{formatCurrency(paidThisMonth)}</p>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {invoices?.map((invoice) => {
          const company = oneRelation(invoice.companies)
          const overdueRow = invoice.due_date && new Date(invoice.due_date) < new Date()
          return (
            <article key={invoice.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900">{company?.name}</p>
                  <p className={`mt-1 text-xs ${overdueRow ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                    Due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium ${
                  invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {String(invoice.status || '').replace('_', ' ')}
                </span>
              </div>
              <p className="text-base font-semibold text-gray-900">{formatCurrency(invoice.amount)}</p>
              <Link
                href={`/crm/invoices/${invoice.id}`}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
              >
                View {invoice.invoice_number}
              </Link>
            </article>
          )
        })}
        {(!invoices || invoices.length === 0) && (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-[var(--color-text-secondary)]">No open receivables.</div>
        )}
      </div>
      
      <div className="hidden overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Company</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Invoice #</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Amount</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Due Date</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map(invoice => {
              const company = oneRelation(invoice.companies)
              return (
              <tr key={invoice.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                <td className="p-3 text-sm font-medium">{company?.name}</td>
                <td className="p-3 text-sm">
                  <Link
                    href={`/crm/invoices/${invoice.id}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
                  >
                    {invoice.invoice_number}
                  </Link>
                </td>
                <td className="p-3 text-sm">{formatCurrency(invoice.amount)}</td>
                <td className={`p-3 text-sm ${invoice.due_date && new Date(invoice.due_date) < new Date() ? 'font-semibold text-red-600' : ''}`}>
                  {formatDate(invoice.due_date)}
                </td>
                <td className="p-3 text-sm">
                  <span className={`rounded px-2 py-1 text-xs font-medium ${
                    invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {String(invoice.status || '').replace('_', ' ')}
                  </span>
                </td>
              </tr>
              )
            })}
            {(!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[var(--color-text-secondary)]">No open receivables.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
