import { createPartner, updatePartner, removePartner } from '@/app/crm/partners/actions'
import { asFormAction } from '@/lib/form-action'
import { ConfirmAction } from '@/components/ui/confirm-action'

type PartnerRow = {
  id: string
  name: string
  city?: string | null
  contact_person?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  is_active?: boolean | null
  category?: string | null
  credit_period_days?: number | null
  service_type?: string | null
  tracking_supported?: boolean | null
}

export function PartnerDirectory({
  title,
  table,
  rows,
  canManage,
}: {
  title: string
  table: 'suppliers' | 'printing_vendors' | 'courier_partners'
  rows: PartnerRow[]
  canManage: boolean
}) {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">{title}</h1>

      {canManage && (
        <form action={asFormAction(createPartner)} className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-3 text-xs">
          <input type="hidden" name="table" value={table} />
          <input name="name" required placeholder="Name" className="border rounded-lg px-2 py-2" />
          <input name="city" placeholder="City" className="border rounded-lg px-2 py-2" />
          <input name="contact_person" placeholder="Contact person" className="border rounded-lg px-2 py-2" />
          <input name="phone" placeholder="Phone" className="border rounded-lg px-2 py-2" />
          <input name="email" type="email" placeholder="Email" className="border rounded-lg px-2 py-2" />
          {table === 'suppliers' && (
            <>
              <input name="category" placeholder="Category" className="border rounded-lg px-2 py-2" />
              <input name="credit_period_days" type="number" min="0" defaultValue={0} placeholder="Credit days" className="border rounded-lg px-2 py-2" />
            </>
          )}
          {table !== 'suppliers' && (
            <input name="service_type" placeholder={table === 'printing_vendors' ? 'Printing methods' : 'Service type'} className="border rounded-lg px-2 py-2" />
          )}
          {table === 'courier_partners' && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="tracking_supported" value="true" />
              Tracking supported
            </label>
          )}
          <button className="bg-[#1A3022] text-white rounded-lg font-semibold md:col-span-3 py-2">Add</button>
        </form>
      )}

      <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Name</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">City</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Contact</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Phone</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Details</th>
              <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Status</th>
              {canManage && <th className="p-3 font-medium text-sm text-[var(--color-text-secondary)]">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] align-top">
                <td className="p-3 text-sm font-medium">{row.name}</td>
                <td className="p-3 text-sm">{row.city || '-'}</td>
                <td className="p-3 text-sm">{row.contact_person || '-'}</td>
                <td className="p-3 text-sm">{row.phone || '-'}</td>
                <td className="p-3 text-sm">
                  {table === 'suppliers' ? (
                    <>
                      {row.category || '—'} · {row.credit_period_days ?? 0} days
                    </>
                  ) : table === 'printing_vendors' ? (
                    row.service_type || '—'
                  ) : (
                    row.tracking_supported ? 'Tracking supported' : row.service_type || '—'
                  )}
                </td>
                <td className="p-3 text-sm">
                  {row.is_active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">Inactive</span>
                  )}
                </td>
                {canManage && (
                  <td className="p-3 text-xs space-y-2">
                    <form action={asFormAction(updatePartner)} className="grid gap-1">
                      <input type="hidden" name="table" value={table} />
                      <input type="hidden" name="id" value={row.id} />
                      <input name="name" defaultValue={row.name} required className="border rounded px-2 py-1" />
                      <input name="city" defaultValue={row.city || ''} placeholder="City" className="border rounded px-2 py-1" />
                      <input name="contact_person" defaultValue={row.contact_person || ''} placeholder="Contact" className="border rounded px-2 py-1" />
                      <input name="phone" defaultValue={row.phone || ''} placeholder="Phone" className="border rounded px-2 py-1" />
                      <input name="email" defaultValue={row.email || ''} placeholder="Email" className="border rounded px-2 py-1" />
                      {table === 'suppliers' && (
                        <>
                          <input name="category" defaultValue={row.category || ''} placeholder="Category" className="border rounded px-2 py-1" />
                          <input name="credit_period_days" type="number" defaultValue={row.credit_period_days ?? 0} className="border rounded px-2 py-1" />
                        </>
                      )}
                      {table !== 'suppliers' && (
                        <input name="service_type" defaultValue={row.service_type || ''} className="border rounded px-2 py-1" />
                      )}
                      {table === 'courier_partners' && (
                        <label className="flex items-center gap-1">
                          <input type="checkbox" name="tracking_supported" value="true" defaultChecked={Boolean(row.tracking_supported)} />
                          Tracking
                        </label>
                      )}
                      <select name="is_active" defaultValue={row.is_active ? 'true' : 'false'} className="border rounded px-2 py-1">
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                      <button className="text-[#1A3022] font-semibold underline text-left">Save</button>
                    </form>
                    <ConfirmAction
                      title={`Remove ${row.name}?`}
                      confirmLabel="Delete"
                      action={asFormAction(removePartner)}
                      hiddenFields={{ table, id: row.id }}
                      description={
                        <p>
                          If this vendor is used on orders or products it will be deactivated instead of permanently deleted.
                        </p>
                      }
                    >
                      Remove
                    </ConfirmAction>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="p-4 text-center text-[var(--color-text-secondary)]">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
