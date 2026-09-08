'use client'

import { createPartner, updatePartner, removePartner } from '@/app/crm/partners/actions'
import { asFormAction } from '@/lib/form-action'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

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

const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const fieldClass =
  'min-h-10 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2 text-sm'

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-primary)]">{title}</h1>

      {canManage && (
        <form
          action={asFormAction(createPartner)}
          className="grid gap-3 rounded-2xl border border-[#E8E4DE] bg-white p-4 text-sm md:grid-cols-3"
        >
          <input type="hidden" name="table" value={table} />
          <input name="name" required placeholder="Name" className={fieldClass} />
          <input name="city" placeholder="City" className={fieldClass} />
          <input name="contact_person" placeholder="Contact person" className={fieldClass} />
          <input name="phone" placeholder="Phone" className={fieldClass} />
          <input name="email" type="email" placeholder="Email" className={fieldClass} />
          {table === 'suppliers' && (
            <>
              <input name="category" placeholder="Category" className={fieldClass} />
              <input
                name="credit_period_days"
                type="number"
                min="0"
                defaultValue={0}
                placeholder="Credit days"
                className={fieldClass}
              />
            </>
          )}
          {table !== 'suppliers' && (
            <input
              name="service_type"
              placeholder={table === 'printing_vendors' ? 'Printing methods' : 'Service type'}
              className={fieldClass}
            />
          )}
          {table === 'courier_partners' && (
            <label className="flex min-h-10 items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" name="tracking_supported" value="true" />
              Tracking supported
            </label>
          )}
          <button
            type="submit"
            className="min-h-10 rounded-lg bg-[#1A3022] py-2 font-semibold text-white hover:bg-[#274433] hover:text-white md:col-span-3"
          >
            Add
          </button>
        </form>
      )}

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="space-y-3 rounded-xl border border-[#E8E4DE] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1C1917]">{row.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{row.city || '—'}</p>
              </div>
              {row.is_active ? (
                <span className="shrink-0 rounded bg-green-100 px-2 py-1 text-[11px] font-medium text-green-800">
                  Active
                </span>
              ) : (
                <span className="shrink-0 rounded bg-red-100 px-2 py-1 text-[11px] font-medium text-red-800">
                  Inactive
                </span>
              )}
            </div>

            <dl className="grid gap-1 text-xs text-gray-600">
              <div>
                <dt className="inline text-gray-400">Contact · </dt>
                <dd className="inline">{row.contact_person || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-gray-400">Phone · </dt>
                <dd className="inline">{row.phone || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-gray-400">Details · </dt>
                <dd className="inline">
                  {table === 'suppliers'
                    ? `${row.category || '—'} · ${row.credit_period_days ?? 0} days`
                    : table === 'printing_vendors'
                      ? row.service_type || '—'
                      : row.tracking_supported
                        ? 'Tracking supported'
                        : row.service_type || '—'}
                </dd>
              </div>
            </dl>

            {canManage && (
              <form action={asFormAction(updatePartner)} className="grid gap-2 border-t border-[#EFE9E0] pt-3">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={row.id} />
                <input name="name" defaultValue={row.name} required className={fieldClass} />
                <input name="city" defaultValue={row.city || ''} placeholder="City" className={fieldClass} />
                <input
                  name="contact_person"
                  defaultValue={row.contact_person || ''}
                  placeholder="Contact"
                  className={fieldClass}
                />
                <input name="phone" defaultValue={row.phone || ''} placeholder="Phone" className={fieldClass} />
                <input name="email" defaultValue={row.email || ''} placeholder="Email" className={fieldClass} />
                {table === 'suppliers' && (
                  <>
                    <input
                      name="category"
                      defaultValue={row.category || ''}
                      placeholder="Category"
                      className={fieldClass}
                    />
                    <input
                      name="credit_period_days"
                      type="number"
                      defaultValue={row.credit_period_days ?? 0}
                      className={fieldClass}
                    />
                  </>
                )}
                {table !== 'suppliers' && (
                  <input name="service_type" defaultValue={row.service_type || ''} className={fieldClass} />
                )}
                {table === 'courier_partners' && (
                  <label className="flex min-h-10 items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      name="tracking_supported"
                      value="true"
                      defaultChecked={Boolean(row.tracking_supported)}
                    />
                    Tracking
                  </label>
                )}
                <MobileSheetSelect
                  name="is_active"
                  label="Status"
                  defaultValue={row.is_active ? 'true' : 'false'}
                  options={STATUS_OPTIONS}
                />
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white"
                >
                  Save
                </button>
                <ConfirmAction
                  title={`Remove ${row.name}?`}
                  confirmLabel="Delete"
                  action={asFormAction(removePartner)}
                  hiddenFields={{ table, id: row.id }}
                  description={
                    <p>
                      If this vendor is used on orders or products it will be deactivated instead of permanently
                      deleted.
                    </p>
                  }
                >
                  Remove
                </ConfirmAction>
              </form>
            )}
          </article>
        ))}
        {rows.length === 0 && (
          <p className="rounded-xl border border-[#E8E4DE] bg-white p-4 text-center text-sm text-gray-500">
            No records found.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-gray-50">
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Name</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">City</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Contact</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Phone</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Details</th>
              <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Status</th>
              {canManage && (
                <th className="p-3 text-sm font-medium text-[var(--color-text-secondary)]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="align-top border-b border-[var(--color-border)]">
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
                  ) : row.tracking_supported ? (
                    'Tracking supported'
                  ) : (
                    row.service_type || '—'
                  )}
                </td>
                <td className="p-3 text-sm">
                  {row.is_active ? (
                    <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Active</span>
                  ) : (
                    <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Inactive</span>
                  )}
                </td>
                {canManage && (
                  <td className="space-y-2 p-3 text-xs">
                    <form action={asFormAction(updatePartner)} className="grid gap-2">
                      <input type="hidden" name="table" value={table} />
                      <input type="hidden" name="id" value={row.id} />
                      <input name="name" defaultValue={row.name} required className="rounded border px-2 py-1" />
                      <input
                        name="city"
                        defaultValue={row.city || ''}
                        placeholder="City"
                        className="rounded border px-2 py-1"
                      />
                      <input
                        name="contact_person"
                        defaultValue={row.contact_person || ''}
                        placeholder="Contact"
                        className="rounded border px-2 py-1"
                      />
                      <input
                        name="phone"
                        defaultValue={row.phone || ''}
                        placeholder="Phone"
                        className="rounded border px-2 py-1"
                      />
                      <input
                        name="email"
                        defaultValue={row.email || ''}
                        placeholder="Email"
                        className="rounded border px-2 py-1"
                      />
                      {table === 'suppliers' && (
                        <>
                          <input
                            name="category"
                            defaultValue={row.category || ''}
                            placeholder="Category"
                            className="rounded border px-2 py-1"
                          />
                          <input
                            name="credit_period_days"
                            type="number"
                            defaultValue={row.credit_period_days ?? 0}
                            className="rounded border px-2 py-1"
                          />
                        </>
                      )}
                      {table !== 'suppliers' && (
                        <input
                          name="service_type"
                          defaultValue={row.service_type || ''}
                          className="rounded border px-2 py-1"
                        />
                      )}
                      {table === 'courier_partners' && (
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            name="tracking_supported"
                            value="true"
                            defaultChecked={Boolean(row.tracking_supported)}
                          />
                          Tracking
                        </label>
                      )}
                      <MobileSheetSelect
                        name="is_active"
                        label="Status"
                        defaultValue={row.is_active ? 'true' : 'false'}
                        options={STATUS_OPTIONS}
                      />
                      <button
                        type="submit"
                        className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white"
                      >
                        Save
                      </button>
                    </form>
                    <ConfirmAction
                      title={`Remove ${row.name}?`}
                      confirmLabel="Delete"
                      action={asFormAction(removePartner)}
                      hiddenFields={{ table, id: row.id }}
                      description={
                        <p>
                          If this vendor is used on orders or products it will be deactivated instead of permanently
                          deleted.
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
