import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'

export default async function PaymentsPage() {
  await requireStaff(['admin', 'accounts', 'management'])
  const supabase = await createClient()

  const { data: payments } = await supabase.from('payments').select('*, invoices(invoice_number, companies(name))').order('payment_date', { ascending: false })
  
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const totalThisMonth = payments?.filter(p => p.payment_date >= currentMonthStart).reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Payments Received</h1>
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-green-800 shadow-sm">
          <span className="mr-2 text-sm font-medium">Total This Month:</span>
          <span className="text-lg font-bold">{formatCurrency(totalThisMonth)}</span>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {payments?.map((payment) => {
          const invoice = oneRelation(payment.invoices)
          const company = oneRelation(invoice?.companies)
          return (
            <article key={payment.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-green-700">{formatCurrency(payment.amount)}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatDate(payment.payment_date)}</p>
                </div>
                <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-600">
                  {String(payment.method || '').replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-600">{company?.name || '—'} · Ref {payment.reference || '—'}</p>
              {payment.invoice_id ? (
                <Link
                  href={`/crm/invoices/${payment.invoice_id}`}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
                >
                  View {invoice?.invoice_number || 'invoice'}
                </Link>
              ) : null}
            </article>
          )
        })}
        {(!payments || payments.length === 0) && (
          <div className="rounded-xl border bg-white p-6 text-center text-sm text-[var(--color-text-secondary)]">No payments found.</div>
        )}
      </div>
      
      <div className="hidden overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Date</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Amount</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Method</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Reference</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Invoice #</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Company</th>
            </tr>
          </thead>
          <tbody>
            {payments?.map(payment => {
              const invoice = oneRelation(payment.invoices)
              const company = oneRelation(invoice?.companies)
              return (
              <tr key={payment.id} className="border-b border-[var(--color-border)] hover:bg-gray-50">
                <td className="p-3 text-sm">{formatDate(payment.payment_date)}</td>
                <td className="p-3 text-sm font-medium text-green-600">{formatCurrency(payment.amount)}</td>
                <td className="p-3 text-sm">
                  <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium uppercase tracking-wider text-gray-600">
                    {String(payment.method || '').replace('_', ' ')}
                  </span>
                </td>
                <td className="p-3 text-sm text-[var(--color-text-secondary)]">{payment.reference || '-'}</td>
                <td className="p-3 text-sm">
                  <Link
                    href={`/crm/invoices/${payment.invoice_id}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
                  >
                    {invoice?.invoice_number}
                  </Link>
                </td>
                <td className="p-3 text-sm">{company?.name}</td>
              </tr>
              )
            })}
            {(!payments || payments.length === 0) && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-[var(--color-text-secondary)]">No payments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
