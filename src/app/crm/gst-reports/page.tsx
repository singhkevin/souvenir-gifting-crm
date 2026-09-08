import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, oneRelation } from '@/lib/utils'
import { requireStaff } from '@/lib/auth'
import Link from 'next/link'
import { MobileDateRangeFilter } from '@/components/ui/mobile-filter-sheet'

type NamedCompany = { id?: string; name?: string | null; gst_number?: string | null; state?: string | null }
type QuoteTax = {
  id: string
  tax_percent?: number | null
  tax_amount?: number | null
  subtotal?: number | null
  total?: number | null
}

function money(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export default async function GstReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  await requireStaff(['admin', 'accounts', 'management'])
  const params = await searchParams
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('org_settings')
    .select('default_tax_percent')
    .limit(1)
    .maybeSingle()

  let query = supabase
    .from('invoices')
    .select(`
      id, invoice_number, amount, status, invoice_date,
      company:companies(id, name, gst_number, state),
      order:orders(id, order_number, quotation_id)
    `)
    .order('invoice_date', { ascending: false })

  if (params.from) query = query.gte('invoice_date', params.from)
  if (params.to) query = query.lte('invoice_date', params.to)

  const { data: invoices, error } = await query
  const rows = (invoices || []) as Array<{
    id: string
    invoice_number: string
    amount: number | string | null
    status: string
    invoice_date: string | null
    company?: NamedCompany | NamedCompany[] | null
    order?: { id?: string; order_number?: string | null; quotation_id?: string | null } | { id?: string; order_number?: string | null; quotation_id?: string | null }[] | null
  }>

  const quoteIds = Array.from(new Set(
    rows
      .map((row) => oneRelation(row.order)?.quotation_id)
      .filter((id): id is string => Boolean(id)),
  ))

  const { data: quotes } = quoteIds.length
    ? await supabase.from('quotations').select('id, tax_percent, tax_amount, subtotal, total').in('id', quoteIds)
    : { data: [] as QuoteTax[] }

  const quoteById = new Map((quotes || []).map((q) => [q.id, q]))

  const mapped = rows.map((row) => {
    const company = oneRelation(row.company)
    const order = oneRelation(row.order)
    const tax = order?.quotation_id ? quoteById.get(order.quotation_id) : undefined
    const invoiceTotal = money(row.amount)
    const taxable = money(tax?.subtotal)
    const gst = money(tax?.tax_amount)
    const rate = money(tax?.tax_percent)
    return {
      id: row.id,
      invoice_number: row.invoice_number,
      invoice_date: row.invoice_date,
      status: row.status,
      companyName: company?.name || '—',
      gstin: company?.gst_number || null,
      invoiceTotal,
      taxable,
      gst,
      rate,
    }
  })

  const taxableTotal = mapped.reduce((sum, row) => sum + (row.taxable ?? 0), 0)
  const gstTotal = mapped.reduce((sum, row) => sum + (row.gst ?? 0), 0)
  const grandTotal = mapped.reduce((sum, row) => sum + (row.invoiceTotal ?? 0), 0)
  const withStoredGst = mapped.filter((row) => row.gst != null).length

  const byCompany = new Map<string, { name: string; gstin: string | null; invoices: number; taxable: number; gst: number; total: number }>()
  for (const row of mapped) {
    const key = row.companyName
    const current = byCompany.get(key) || {
      name: row.companyName,
      gstin: row.gstin,
      invoices: 0,
      taxable: 0,
      gst: 0,
      total: 0,
    }
    current.invoices += 1
    current.taxable += row.taxable ?? 0
    current.gst += row.gst ?? 0
    current.total += row.invoiceTotal ?? 0
    if (!current.gstin && row.gstin) current.gstin = row.gstin
    byCompany.set(key, current)
  }

  const defaultRate = money(settings?.default_tax_percent)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-primary)]">GST Reports</h1>
          <p className="text-xs text-[#7A7267] mt-1">GST and tax reporting for invoices and transactions</p>
        </div>
        <Link href="/crm/reports" className="text-xs text-[#4A235A] font-semibold">
          Business analytics →
        </Link>
      </div>

      <MobileDateRangeFilter
        from={params.from || ''}
        to={params.to || ''}
        clearHref="/crm/gst-reports"
        submitLabel="Apply period"
        className="rounded-2xl border border-[#E5DFD5] bg-white p-3 sm:p-4"
      />

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
          GST invoices could not be loaded. {error.message}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Taxable Value</p>
          <p className="text-2xl font-bold">{formatCurrency(taxableTotal)}</p>
          <p className="text-[10px] text-[#7A7267] mt-1">From linked quotations only</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total GST</p>
          <p className="text-2xl font-bold">{formatCurrency(gstTotal)}</p>
          <p className="text-[10px] text-[#7A7267] mt-1">{withStoredGst} invoice{withStoredGst === 1 ? '' : 's'} with stored tax</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">CGST</p>
          <p className="text-2xl font-bold">—</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">SGST</p>
          <p className="text-2xl font-bold">—</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">IGST</p>
          <p className="text-2xl font-bold">—</p>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-[#E5DFD5] text-xs space-y-2">
        <h2 className="font-bold text-sm text-[#1C1917]">GST Summary</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div><span className="text-[#7A7267]">Taxable amount</span><p className="font-semibold">{formatCurrency(taxableTotal)}</p></div>
          <div><span className="text-[#7A7267]">Total GST</span><p className="font-semibold">{formatCurrency(gstTotal)}</p></div>
          <div><span className="text-[#7A7267]">Invoice grand total</span><p className="font-semibold">{formatCurrency(grandTotal)}</p></div>
          <div>
            <span className="text-[#7A7267]">Org default tax rate</span>
            <p className="font-semibold">{defaultRate != null ? `${defaultRate}%` : '—'}</p>
          </div>
        </div>
        <p className="text-[#7A7267] pt-2 border-t">
          Invoices store a single total. GST rate and tax amount are taken from the linked quotation when present
          ({defaultRate != null ? `organisation default ${defaultRate}%` : 'see organisation settings'}).
          CGST, SGST and IGST are not stored on invoices, so those columns stay as —.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5DFD5] overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h2 className="font-bold text-sm">Invoice-wise GST Report</h2>
        </div>
        <table className="w-full text-left text-xs min-w-[880px]">
          <thead className="bg-[#FAF7F2] text-[#7A7267]">
            <tr>
              <th className="p-3 font-semibold">Invoice Number</th>
              <th className="p-3 font-semibold">Invoice Date</th>
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold">GSTIN</th>
              <th className="p-3 font-semibold text-right">Taxable Amount</th>
              <th className="p-3 font-semibold">GST Rate</th>
              <th className="p-3 font-semibold text-right">CGST</th>
              <th className="p-3 font-semibold text-right">SGST</th>
              <th className="p-3 font-semibold text-right">IGST</th>
              <th className="p-3 font-semibold text-right">Total GST</th>
              <th className="p-3 font-semibold text-right">Invoice Total</th>
              <th className="p-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE9E0]">
            {mapped.map((row) => (
              <tr key={row.id} className="hover:bg-[#FAF7F2]">
                <td className="p-3 font-mono">
                  <Link href={`/crm/invoices/${row.id}`} className="text-[#4A235A] hover:underline">{row.invoice_number}</Link>
                </td>
                <td className="p-3">{formatDate(row.invoice_date)}</td>
                <td className="p-3">{row.companyName}</td>
                <td className="p-3 font-mono">{row.gstin || '—'}</td>
                <td className="p-3 text-right">{row.taxable != null ? formatCurrency(row.taxable) : '—'}</td>
                <td className="p-3">{row.rate != null ? `${row.rate}%` : '—'}</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right">—</td>
                <td className="p-3 text-right">{row.gst != null ? formatCurrency(row.gst) : '—'}</td>
                <td className="p-3 text-right font-medium">{row.invoiceTotal != null ? formatCurrency(row.invoiceTotal) : '—'}</td>
                <td className="p-3 capitalize">{row.status.replace('_', ' ')}</td>
              </tr>
            ))}
            {mapped.length === 0 && (
              <tr>
                <td colSpan={12} className="p-8 text-center text-gray-500">No invoices in this period.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5DFD5] overflow-x-auto">
        <div className="px-4 py-3 border-b">
          <h2 className="font-bold text-sm">GST by Customer</h2>
        </div>
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FAF7F2] text-[#7A7267]">
            <tr>
              <th className="p-3 font-semibold">Customer</th>
              <th className="p-3 font-semibold">GSTIN</th>
              <th className="p-3 font-semibold text-right">Invoices</th>
              <th className="p-3 font-semibold text-right">Taxable Amount</th>
              <th className="p-3 font-semibold text-right">Total GST</th>
              <th className="p-3 font-semibold text-right">Invoice Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE9E0]">
            {Array.from(byCompany.values()).map((row) => (
              <tr key={row.name}>
                <td className="p-3">{row.name}</td>
                <td className="p-3 font-mono">{row.gstin || '—'}</td>
                <td className="p-3 text-right">{row.invoices}</td>
                <td className="p-3 text-right">{formatCurrency(row.taxable)}</td>
                <td className="p-3 text-right">{formatCurrency(row.gst)}</td>
                <td className="p-3 text-right font-medium">{formatCurrency(row.total)}</td>
              </tr>
            ))}
            {byCompany.size === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">No customer GST totals yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
