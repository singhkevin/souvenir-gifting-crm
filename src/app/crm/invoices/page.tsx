import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { requireStaff } from '@/lib/auth'
import { MobileFilterBar } from '@/components/ui/mobile-filter-sheet'

function InvoiceStatusChip({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 font-mono text-[11px] uppercase text-[#3A4537]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> paid
      </span>
    )
  }
  if (status === 'partially_paid' || status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#9E4300]/30 bg-[#FFB690]/30 px-2 py-0.5 font-mono text-[11px] uppercase text-[#9E4300]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#9E4300]" /> {status.replace('_', ' ')}
      </span>
    )
  }
  if (status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none border border-[#BA1A1A]/40 bg-[#BA1A1A]/10 px-2 py-0.5 font-mono text-[11px] uppercase text-[#BA1A1A]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#BA1A1A]" /> overdue
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] px-2 py-0.5 font-mono text-[11px] uppercase text-[#4A4640]">
      {status}
    </span>
  )
}

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
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
          Invoices
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total Issued</p>
          <p className="mt-1 break-words font-mono text-lg font-semibold text-[#1C1B1A]">{formatCurrency(totalIssued)}</p>
        </div>
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Total Paid</p>
          <p className="mt-1 break-words font-mono text-lg font-semibold text-[#3A4537]">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Outstanding</p>
          <p className="mt-1 break-words font-mono text-lg font-semibold text-[#9E4300]">{formatCurrency(outstanding)}</p>
        </div>
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Overdue</p>
          <p className="mt-1 break-words font-mono text-lg font-semibold text-[#BA1A1A]">{formatCurrency(overdue)}</p>
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
      
      {/* Desktop Invoices Table */}
      <div className="hidden overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2] md:block">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Invoice #</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order #</th>
              <th className="px-3.5 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Amount (₹)</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Due Date</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {invoices?.map((invoice) => {
              const company = oneRelation(invoice.companies)
              const order = oneRelation(invoice.orders)
              const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid'

              return (
                <tr key={invoice.id} className={`transition-colors hover:bg-[#F6F3EC] ${isOverdue ? 'bg-[#BA1A1A]/5' : ''}`}>
                  <td className="px-3.5 py-2.5">
                    <Link
                      href={`/crm/invoices/${invoice.id}`}
                      className="font-mono font-medium text-[#1C1B1A] transition-colors hover:text-[#9E4300]"
                    >
                      {invoice.invoice_number}
                    </Link>
                  </td>
                  <td className="px-3.5 py-2.5 text-[#1C1B1A]">{company?.name || '—'}</td>
                  <td className="px-3.5 py-2.5 font-mono text-[#4A4640]">{order?.order_number || '—'}</td>
                  <td className="px-3.5 py-2.5 text-right font-mono font-medium text-[#1C1B1A]">{formatCurrency(invoice.amount)}</td>
                  <td className="px-3.5 py-2.5">
                    <span className={`font-mono ${isOverdue ? 'font-semibold text-[#BA1A1A]' : 'text-[#4A4640]'}`}>
                      {formatDate(invoice.due_date)}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <InvoiceStatusChip status={invoice.status} />
                  </td>
                </tr>
              )
            })}
            {(!invoices || invoices.length === 0) && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-xs text-[#7C766F]">
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {invoices && invoices.length > 0 ? (
          invoices.map((invoice) => {
            const company = oneRelation(invoice.companies)
            const order = oneRelation(invoice.orders)
            const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid'

            return (
              <article key={invoice.id} className="space-y-2 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/crm/invoices/${invoice.id}`}
                    className="font-mono text-xs font-semibold text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    {invoice.invoice_number}
                  </Link>
                  <InvoiceStatusChip status={invoice.status} />
                </div>

                <div className="font-mono text-sm font-semibold text-[#1C1B1A]">
                  {formatCurrency(invoice.amount)}
                </div>

                <div className="space-y-1 border-t border-[#CCC5BD] pt-2 text-xs text-[#4A4640]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Company: </span>
                    {company?.name || '—'}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Order: </span>
                    <span className="font-mono">{order?.order_number || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Due Date: </span>
                    <span className={`font-mono ${isOverdue ? 'font-semibold text-[#BA1A1A]' : ''}`}>
                      {formatDate(invoice.due_date)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#CCC5BD] pt-2">
                  <Link
                    href={`/crm/invoices/${invoice.id}`}
                    className="text-xs font-bold uppercase tracking-[0.08em] text-[#1C1B1A] hover:text-[#9E4300]"
                  >
                    View Invoice →
                  </Link>
                </div>
              </article>
            )
          })
        ) : (
          <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-8 text-center text-xs text-[#7C766F]">
            No invoices found.
          </div>
        )}
      </div>
    </div>
  )
}
