import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'

function fileHref(path: string | null) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path
  return path
}

export default async function PortalDocumentsPage() {
  const supabase = await createClient()
  const { data: companyId } = await supabase.rpc('client_company_id')
  const [{ data: invoices }, { data: mockups }] = await Promise.all([
    supabase
      .from('invoices')
      .select('id, invoice_number, amount, status, due_date, invoice_date')
      .eq('company_id', companyId)
      .order('invoice_date', { ascending: false }),
    supabase
      .from('mockups')
      .select('id, file_name, storage_path, mime_type, created_at, status')
      .eq('status', 'shared')
      .order('created_at', { ascending: false }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Documents</h1>
        <p className="text-sm text-gray-500">Invoices and shared mockups for your organisation. Internal cost and margin are never shown.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Invoices</h2>

        <div className="space-y-3 p-3 md:hidden">
          {(invoices || []).map((inv) => (
            <article key={inv.id} className="rounded-xl border border-[#E8E4DE] bg-[#FAF7F2] p-4">
              <p className="font-mono text-sm font-semibold text-gray-900">{inv.invoice_number}</p>
              <p className="mt-1 text-xs text-gray-500">
                {formatDate(inv.invoice_date)} · due {formatDate(inv.due_date)}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="font-semibold text-gray-900">{formatCurrency(inv.amount)}</p>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium capitalize text-gray-700">
                  {inv.status}
                </span>
              </div>
            </article>
          ))}
          {(!invoices || invoices.length === 0) && (
            <p className="py-6 text-center text-sm text-gray-500">No invoices yet.</p>
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {(invoices || []).map((inv) => (
                <tr key={inv.id} className="border-t">
                  <td className="px-4 py-3 font-mono">{inv.invoice_number}</td>
                  <td className="px-4 py-3">{formatDate(inv.invoice_date)}</td>
                  <td className="px-4 py-3">{formatDate(inv.due_date)}</td>
                  <td className="px-4 py-3">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3 capitalize">{inv.status}</td>
                </tr>
              ))}
              {(!invoices || invoices.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No invoices yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white">
        <h2 className="border-b px-4 py-3 text-sm font-semibold">Shared mockups</h2>

        <div className="space-y-3 p-3 md:hidden">
          {(mockups || []).map((m) => {
            const href = fileHref(m.storage_path)
            return (
              <article key={m.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-[#FAF7F2] p-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{m.file_name}</p>
                  <p className="mt-1 text-xs text-gray-500">{m.mime_type} · {formatDate(m.created_at)}</p>
                </div>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433]"
                  >
                    Open file
                  </a>
                ) : null}
              </article>
            )
          })}
          {(!mockups || mockups.length === 0) && (
            <p className="py-6 text-center text-sm text-gray-500">No mockups shared yet.</p>
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(mockups || []).map((m) => {
                const href = fileHref(m.storage_path)
                return (
                  <tr key={m.id} className="border-t">
                    <td className="px-4 py-3">{m.file_name}</td>
                    <td className="px-4 py-3">{m.mime_type}</td>
                    <td className="px-4 py-3">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#E5DFD5] bg-white px-3 text-xs font-semibold text-[#1A3022] hover:bg-[#FAF7F2]"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
              {(!mockups || mockups.length === 0) && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No mockups shared yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
