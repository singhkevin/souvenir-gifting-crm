import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { receiveSample, moveSample } from './actions'
import { requireStaff, canSeeCosts } from '@/lib/auth'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; received?: string; moved?: string }>
}) {
  const profile = await requireStaff()
  const supabase = await createClient()
  const showCost = canSeeCosts(profile.role)
  const params = await searchParams
  const error = params.error || ''
  const received = params.received === '1'
  const moved = params.moved === '1'

  const [{ data: samples }, { data: movements }, { data: products }, { data: companies }] = await Promise.all([
    supabase.from('sample_stock').select('*, product:products(name, sku)'),
    supabase.from('sample_movements').select('*, product:products(name), company:companies(name)').order('created_at', { ascending: false }).limit(25),
    supabase.from('products').select('id, name, sku').eq('status', 'active').order('name').limit(200),
    supabase.from('companies').select('id, name').order('name'),
  ])

  const totalInOffice = samples?.reduce((acc, curr) => acc + (curr.in_office || 0), 0) || 0
  const totalWithTeam = samples?.reduce((acc, curr) => acc + (curr.with_team || 0), 0) || 0
  const totalWithClient = samples?.reduce((acc, curr) => acc + (curr.with_client || 0), 0) || 0
  const totalPending = samples?.reduce((acc, curr) => acc + (curr.pending_supplier || 0), 0) || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Sample Management</h1>
        <p className="text-xs text-[#7A7267] mt-1">
          Track physical samples in office, with the team, with a client, or pending from a supplier. Use{' '}
          <span className="font-semibold text-[#1A3022]">Send to client</span> on any product below to dispatch samples
          directly to a company.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
      ) : null}
      {received ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Sample received into office stock.
        </div>
      ) : null}
      {moved ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Sample movement recorded.
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['In Office', totalInOffice],
          ['With Team', totalWithTeam],
          ['With Client', totalWithClient],
          ['Pending Supplier', totalPending],
        ].map(([label, value]) => (
          <div key={String(label)} className="p-4 bg-white border rounded-xl">
            <p className="text-xs text-[#7A7267]">{label}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <form action={asFormAction(receiveSample)} className="grid items-end gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-4">
        <MobileSheetSelect
          name="product_id"
          label="Product"
          required
          showDesktopLabel
          emptyLabel="Select product to receive"
          className="md:col-span-2"
          options={[
            { value: '', label: 'Select product to receive' },
            ...(products || []).map((p) => ({ value: p.id, label: `${p.name} · ${p.sku}` })),
          ]}
        />
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Quantity</span>
          <input name="quantity" type="number" min="1" defaultValue={1} required className="min-h-11 w-full rounded-lg border px-2 py-2" />
        </label>
        {showCost ? (
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7A7267]">Unit cost</span>
            <input name="unit_cost" type="number" step="0.01" min="0" placeholder="0.00" className="min-h-11 w-full rounded-lg border px-2 py-2" />
          </label>
        ) : (
          <input type="hidden" name="unit_cost" value="0" />
        )}
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1A3022] px-4 py-2.5 font-semibold text-white md:col-span-4"
        >
          Receive into office
        </button>
      </form>

      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAF7F2] text-xs text-[#7A7267]">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Office</th>
              <th className="p-3">Team</th>
              <th className="p-3">Client</th>
              <th className="p-3">Supplier</th>
              {showCost && <th className="p-3">Unit cost</th>}
              <th className="p-3">Move</th>
            </tr>
          </thead>
          <tbody>
            {(samples || []).map((sample) => {
              const product = Array.isArray(sample.product) ? sample.product[0] : sample.product
              return (
                <tr key={sample.id} className="border-t align-top">
                  <td className="p-3">
                    <Link href={`/crm/products/${sample.product_id}`} className="font-medium hover:underline">{product?.name}</Link>
                    <p className="text-[11px] text-[#7A7267]">{product?.sku}</p>
                  </td>
                  <td className="p-3">{sample.in_office || 0}</td>
                  <td className="p-3">{sample.with_team || 0}</td>
                  <td className="p-3">{sample.with_client || 0}</td>
                  <td className="p-3">{sample.pending_supplier || 0}</td>
                  {showCost && <td className="p-3">{formatCurrency(sample.unit_cost)}</td>}
                  <td className="p-3">
                    <div className="min-w-[220px] space-y-2">
                      <form
                        action={asFormAction(moveSample)}
                        className="space-y-1.5 rounded-lg border border-[#1A3022]/25 bg-[#F4EFE6] p-2 text-[11px]"
                      >
                        <input type="hidden" name="stock_id" value={sample.id} />
                        <input type="hidden" name="to_holder" value="client" />
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#1A3022]">
                          Send to client
                        </p>
                        <MobileSheetSelect
                          name="from_holder"
                          label="From"
                          defaultValue="office"
                          options={[
                            { value: 'office', label: 'From office' },
                            { value: 'team', label: 'From team' },
                          ]}
                        />
                        <MobileSheetSelect
                          name="company_id"
                          label="Client"
                          required
                          emptyLabel="Select client"
                          options={[
                            { value: '', label: 'Select client' },
                            ...(companies || []).map((c) => ({ value: c.id, label: c.name })),
                          ]}
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            name="quantity"
                            type="number"
                            min="1"
                            defaultValue={1}
                            required
                            className="rounded border px-1 py-1"
                          />
                          <button className="rounded bg-[#1A3022] py-1 font-semibold text-white">Send</button>
                        </div>
                        <input name="note" placeholder="Note (optional)" className="w-full rounded border px-1 py-1" />
                      </form>

                      <details className="text-[11px]">
                        <summary className="cursor-pointer text-[#7A7267]">Other movement</summary>
                        <form action={asFormAction(moveSample)} className="mt-1.5 grid grid-cols-2 gap-1">
                          <input type="hidden" name="stock_id" value={sample.id} />
                          <MobileSheetSelect
                            name="from_holder"
                            label="From"
                            defaultValue="office"
                            options={[
                              { value: 'office', label: 'From office' },
                              { value: 'team', label: 'From team' },
                              { value: 'client', label: 'From client' },
                              { value: 'supplier', label: 'From supplier' },
                            ]}
                          />
                          <MobileSheetSelect
                            name="to_holder"
                            label="To"
                            defaultValue="team"
                            options={[
                              { value: 'team', label: 'To team' },
                              { value: 'office', label: 'To office' },
                              { value: 'supplier', label: 'To supplier' },
                            ]}
                          />
                          <input name="quantity" type="number" min="1" defaultValue={1} className="border rounded px-1 py-1" />
                          <MobileSheetSelect
                            name="company_id"
                            label="Client"
                            emptyLabel="Client (if needed)"
                            options={[
                              { value: '', label: 'Client (if needed)' },
                              ...(companies || []).map((c) => ({ value: c.id, label: c.name })),
                            ]}
                          />
                          <input name="note" placeholder="Note / holder name" className="col-span-2 border rounded px-1 py-1" />
                          <button className="col-span-2 border rounded py-1 font-semibold">Record movement</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              )
            })}
            {(!samples || samples.length === 0) && (
              <tr><td colSpan={7} className="p-6 text-center text-gray-500">No sample stock yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-2xl border p-5">
        <h2 className="font-serif text-lg mb-3">Movement history</h2>
        {(movements || []).map((m) => {
          const product = Array.isArray(m.product) ? m.product[0] : m.product
          const company = Array.isArray(m.company) ? m.company[0] : m.company
          return (
            <p key={m.id} className="text-xs py-1 border-t">
              {formatDateTime(m.created_at)} · {product?.name} · {m.quantity} · {m.from_holder} → {m.to_holder}
              {company?.name ? ` · ${company.name}` : ''} {m.note ? ` · ${m.note}` : ''}
            </p>
          )
        })}
        {(!movements || movements.length === 0) && <p className="text-sm text-gray-500">No movements recorded.</p>}
      </div>
    </div>
  )
}
