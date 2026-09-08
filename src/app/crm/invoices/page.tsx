import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  await requireStaff(['admin', 'accounts', 'management'])
  const supabase = await createClient()
  const statusFilter = params.status || ''

  let query = supabase.from('invoices').select('*, companies(name), orders(order_number)').order('created_at', { ascending: false })
  
  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: invoices } = await query
  
  const totalIssued = invoices?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const totalPaid = invoices?.filter(i => i.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const outstanding = invoices?.filter(i => i.status !== 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0
  const overdue = invoices?.filter(i => new Date(i.due_date) < new Date() && i.status !== 'paid').reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">Invoices</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Total Issued</p>
          <p className="mt-1 break-words text-base font-semibold sm:text-xl">{formatCurrency(totalIssued)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Total Paid</p>
          <p className="mt-1 break-words text-base font-semibold text-green-600 sm:text-xl">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Outstanding</p>
          <p className="mt-1 break-words text-base font-semibold text-amber-600 sm:text-xl">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
          <p className="text-xs text-[var(--color-text-secondary)] sm:text-sm">Overdue</p>
          <p className="mt-1 break-words text-base font-semibold text-red-600 sm:text-xl">{formatCurrency(overdue)}</p>
        </div>
      </div>

      <MobileFilterBar
        pathname="/crm/invoices"
        fields={[
          {
            key: 'status',
            label: 'Status',
            value: statusFilter,
            emptyLabel: 'All statuses',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'partially_paid', label: 'Partially paid' },
              { value: 'paid', label: 'Paid' },
              { value: 'overdue', label: 'Overdue' },
            ],
          },
        ]}
      />
      
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Invoice #</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Company</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Order #</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Amount</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Due Date</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map(invoice => {
              const company = oneRelation(invoice.companies)
              const order = oneRelation(invoice.orders)
              return (
              <tr key={invoice.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                <td className="p-3 text-sm">
                  <Link href={`/crm/invoices/${invoice.id}`} className="text-blue-600 hover:underline">{invoice.invoice_number}</Link>
                </td>
                <td className="p-3 text-sm">{company?.name}</td>
                <td className="p-3 text-sm">{order?.order_number}</td>
                <td className="p-3 text-sm">{formatCurrency(invoice.amount)}</td>
                <td className={`p-3 text-sm ${invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid' ? 'text-red-600 font-medium' : ''}`}>
                  {formatDate(invoice.due_date)}
                </td>
                <td className="p-3 text-sm">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                    invoice.status === 'partially_paid' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.status}
                  </span>
                </td>
              </tr>
              )
            })}
            {(!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[var(--color-text-secondary)]">No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}