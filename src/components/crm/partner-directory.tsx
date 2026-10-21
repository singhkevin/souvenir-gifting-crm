'use client'

import Link from 'next/link'
import { createPartner, updatePartner, removePartner } from '@/app/crm/partners/actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'
import { ActionForm } from '@/components/ui/action-form'
import { SubmitButton } from '@/components/ui/submit-button'

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
  'w-full rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-3 py-2 text-xs text-[#1C1B1A] placeholder:text-[#7C766F] focus:border-[#1C1B1A] focus:outline-none focus:ring-0'

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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#7C766F] mb-1.5">
            <Link href="/crm/dashboard" className="hover:text-[#9E4300] transition-colors">CRM</Link>
            <span>/</span>
            <span>Partners</span>
            <span>/</span>
            <span className="text-[#9E4300] font-semibold">{title.toUpperCase()}</span>
          </div>
          <h1 className="font-[family-name:var(--font-newsreader)] text-[32px] leading-[40px] font-normal tracking-tight text-[#1C1B1A]">
            {title}
          </h1>
          <p className="mt-1 text-xs text-[#4A4640]">
            <span className="font-mono">{rows.length}</span> {rows.length === 1 ? 'partner' : 'partners'} in directory.
          </p>
        </div>
      </div>

      {canManage && (
        <div className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-6 space-y-4">
          <div className="border-b border-[#CCC5BD] bg-[#F6F3EC] px-6 py-3.5 -mx-6 -mt-6 mb-4">
            <h2 className="font-[family-name:var(--font-newsreader)] text-xl font-normal text-[#1C1B1A]">
              Add {title.replace(/s$/, '')}
            </h2>
          </div>
          <ActionForm action={createPartner}
            className="grid gap-3 text-xs md:grid-cols-3"
            resetOnSuccess>
            <input type="hidden" name="table" value={table} />
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Name</label>
              <input name="name" required placeholder="Name" className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">City</label>
              <input name="city" placeholder="City" className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Contact person</label>
              <input name="contact_person" placeholder="Contact person" className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Phone</label>
              <input name="phone" placeholder="Phone" className={fieldClass} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Email</label>
              <input name="email" type="email" placeholder="Email" className={fieldClass} />
            </div>
            {table === 'suppliers' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Category</label>
                  <input name="category" placeholder="Category" className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Credit days</label>
                  <input
                    name="credit_period_days"
                    type="number"
                    min="0"
                    defaultValue={0}
                    placeholder="Credit days"
                    className={fieldClass}
                  />
                </div>
              </>
            )}
            {table !== 'suppliers' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
                  {table === 'printing_vendors' ? 'Printing methods' : 'Service type'}
                </label>
                <input
                  name="service_type"
                  placeholder={table === 'printing_vendors' ? 'Printing methods' : 'Service type'}
                  className={fieldClass}
                />
              </div>
            )}
            {table === 'courier_partners' && (
              <div className="flex items-end">
                <label className="flex min-h-10 items-center gap-2 text-xs text-[#4A4640] cursor-pointer">
                  <input type="checkbox" name="tracking_supported" value="true" className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0" />
                  Tracking supported
                </label>
              </div>
            )}
            <SubmitButton
              className="min-h-10 rounded-none bg-[#1C1B1A] py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors md:col-span-3"
              pendingLabel="Adding…"
            >
              Add
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      {/* Mobile cards */}
      <div className="space-y-4 md:hidden">
        {rows.map((row) => (
          <article key={row.id} className="space-y-3 rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#CCC5BD] pb-3 -mx-4 px-4 -mt-4 pt-4 bg-[#F6F3EC]">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1C1B1A]">{row.name}</p>
                <p className="mt-0.5 text-xs text-[#7C766F]">{row.city || '—'}</p>
              </div>
              {row.is_active ? (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[11px] uppercase text-[#3A4537]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> Active
                </span>
              ) : (
                <span className="shrink-0 inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] uppercase text-[#7C766F]">
                  Inactive
                </span>
              )}
            </div>

            <dl className="grid gap-1.5 text-xs text-[#4A4640]">
              <div>
                <dt className="inline text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Contact · </dt>
                <dd className="inline text-[#1C1B1A]">{row.contact_person || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Phone · </dt>
                <dd className="inline font-mono text-[#1C1B1A]">{row.phone || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Email · </dt>
                <dd className="inline font-mono text-[#1C1B1A]">{row.email || '—'}</dd>
              </div>
              <div>
                <dt className="inline text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Details · </dt>
                <dd className="inline text-[#1C1B1A]">
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
              <ActionForm action={updatePartner} className="grid gap-2 border-t border-[#CCC5BD] pt-3">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={row.id} />
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Name</label>
                  <input name="name" defaultValue={row.name} required className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">City</label>
                  <input name="city" defaultValue={row.city || ''} placeholder="City" className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Contact</label>
                  <input
                    name="contact_person"
                    defaultValue={row.contact_person || ''}
                    placeholder="Contact"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Phone</label>
                  <input name="phone" defaultValue={row.phone || ''} placeholder="Phone" className={fieldClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Email</label>
                  <input name="email" defaultValue={row.email || ''} placeholder="Email" className={fieldClass} />
                </div>
                {table === 'suppliers' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Category</label>
                      <input
                        name="category"
                        defaultValue={row.category || ''}
                        placeholder="Category"
                        className={fieldClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Credit days</label>
                      <input
                        name="credit_period_days"
                        type="number"
                        defaultValue={row.credit_period_days ?? 0}
                        className={fieldClass}
                      />
                    </div>
                  </>
                )}
                {table !== 'suppliers' && (
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
                      {table === 'printing_vendors' ? 'Printing methods' : 'Service type'}
                    </label>
                    <input name="service_type" defaultValue={row.service_type || ''} className={fieldClass} />
                  </div>
                )}
                {table === 'courier_partners' && (
                  <label className="flex min-h-10 items-center gap-2 text-xs text-[#4A4640] cursor-pointer">
                    <input
                      type="checkbox"
                      name="tracking_supported"
                      value="true"
                      defaultChecked={Boolean(row.tracking_supported)}
                      className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0"
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
                <SubmitButton
                  className="inline-flex min-h-10 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
                  pendingLabel="Saving…"
                >
                  Save
                </SubmitButton>
                <ConfirmAction
                  title={`Remove ${row.name}?`}
                  confirmLabel="Delete"
                  action={removePartner}
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
              </ActionForm>
            )}
          </article>
        ))}
        {rows.length === 0 && (
          <p className="rounded-none border border-[#CCC5BD] bg-[#FCF9F2] p-4 text-center text-xs text-[#7C766F]">
            No records found.
          </p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-none border border-[#CCC5BD] bg-[#FCF9F2] md:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-[#CCC5BD] bg-[#F6F3EC]">
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Name</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">City</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Contact</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Phone</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Details</th>
              <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Status</th>
              {canManage && (
                <th className="px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F]">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#CCC5BD] text-xs text-[#1C1B1A]">
            {rows.map((row) => (
              <tr key={row.id} className="align-top transition-colors hover:bg-[#F6F3EC]">
                <td className="px-3.5 py-3 font-semibold text-[#1C1B1A]">{row.name}</td>
                <td className="px-3.5 py-3 text-[#4A4640]">{row.city || '—'}</td>
                <td className="px-3.5 py-3 text-[#4A4640]">{row.contact_person || '—'}</td>
                <td className="px-3.5 py-3 font-mono text-[#1C1B1A]">{row.phone || '—'}</td>
                <td className="px-3.5 py-3 text-[#4A4640]">
                  {table === 'suppliers' ? (
                    <>
                      {row.category || '—'} · <span className="font-mono">{row.credit_period_days ?? 0}</span> days
                    </>
                  ) : table === 'printing_vendors' ? (
                    row.service_type || '—'
                  ) : row.tracking_supported ? (
                    'Tracking supported'
                  ) : (
                    row.service_type || '—'
                  )}
                </td>
                <td className="px-3.5 py-3">
                  {row.is_active ? (
                    <span className="inline-flex items-center gap-1.5 rounded-none border border-[#3A4537]/20 bg-[#DAE6D3] px-2 py-0.5 text-[11px] uppercase text-[#3A4537]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#3A4537]" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-none border border-[#CCC5BD] bg-[#F6F3EC] px-2 py-0.5 text-[11px] uppercase text-[#7C766F]">
                      Inactive
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-3.5 py-3 space-y-2">
                    <ActionForm action={updatePartner} className="grid gap-2">
                      <input type="hidden" name="table" value={table} />
                      <input type="hidden" name="id" value={row.id} />
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Name</label>
                        <input name="name" defaultValue={row.name} required className={fieldClass} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">City</label>
                        <input
                          name="city"
                          defaultValue={row.city || ''}
                          placeholder="City"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Contact</label>
                        <input
                          name="contact_person"
                          defaultValue={row.contact_person || ''}
                          placeholder="Contact"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Phone</label>
                        <input
                          name="phone"
                          defaultValue={row.phone || ''}
                          placeholder="Phone"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Email</label>
                        <input
                          name="email"
                          defaultValue={row.email || ''}
                          placeholder="Email"
                          className={fieldClass}
                        />
                      </div>
                      {table === 'suppliers' && (
                        <>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Category</label>
                            <input
                              name="category"
                              defaultValue={row.category || ''}
                              placeholder="Category"
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">Credit days</label>
                            <input
                              name="credit_period_days"
                              type="number"
                              defaultValue={row.credit_period_days ?? 0}
                              className={fieldClass}
                            />
                          </div>
                        </>
                      )}
                      {table !== 'suppliers' && (
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#7C766F] mb-1">
                            {table === 'printing_vendors' ? 'Printing methods' : 'Service type'}
                          </label>
                          <input
                            name="service_type"
                            defaultValue={row.service_type || ''}
                            className={fieldClass}
                          />
                        </div>
                      )}
                      {table === 'courier_partners' && (
                        <label className="flex items-center gap-1.5 text-xs text-[#4A4640] cursor-pointer">
                          <input
                            type="checkbox"
                            name="tracking_supported"
                            value="true"
                            defaultChecked={Boolean(row.tracking_supported)}
                            className="rounded-none border-[#CCC5BD] text-[#1C1B1A] focus:ring-0"
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
                      <SubmitButton
                        className="inline-flex min-h-9 items-center justify-center rounded-none bg-[#1C1B1A] px-3 text-xs font-bold uppercase tracking-[0.12em] text-[#FCF9F2] hover:bg-[#9E4300] transition-colors"
                        pendingLabel="Saving…">
                        Save
                      </SubmitButton>
                    </ActionForm>
                    <ConfirmAction
                      title={`Remove ${row.name}?`}
                      confirmLabel="Delete"
                      action={removePartner}
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
                <td colSpan={canManage ? 7 : 6} className="px-3.5 py-6 text-center text-[#7C766F]">
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
