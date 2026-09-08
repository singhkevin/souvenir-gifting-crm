import { createClient } from '@/lib/supabase/server'
import { formatDate, asRows, oneRelation } from '@/lib/utils'
import Link from 'next/link'
import { registerMockup, updateMockup, removeMockup } from './actions'
import { ConfirmAction } from '@/components/ui/confirm-action'
import { requireStaff, applyOwnerScope, applyOrderScope } from '@/lib/auth'
import { asFormAction } from '@/lib/form-action'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

type RequirementOption = { id: string; name: string }
type OrderOption = { id: string; order_number: string | null }
type Named = { name?: string | null; full_name?: string | null; company?: Named | Named[] | null }
type MockupRow = {
  id: string
  file_name?: string | null
  mime_type?: string | null
  storage_path?: string | null
  status?: string | null
  created_at?: string | null
  order_id?: string | null
  requirement?: Named | Named[] | null
  order?: { order_number?: string | null } | { order_number?: string | null }[] | null
  uploader?: { full_name?: string | null } | { full_name?: string | null }[] | null
}

function fileHref(path: string | null) {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path
  return path
}

export default async function MockupsPage() {
  const profile = await requireStaff(['admin', 'sales', 'operations', 'management'])
  const supabase = await createClient()

  const [{ data: mockups }, { data: requirements }, { data: orders }] = await Promise.all([
    supabase.from('mockups').select('*, requirement:requirements(name, company:companies(name)), order:orders(order_number), uploader:profiles!uploaded_by(full_name)').order('created_at', { ascending: false }),
    applyOwnerScope(supabase.from('requirements').select('id, name').order('created_at', { ascending: false }).limit(50), profile),
    applyOrderScope(supabase.from('orders').select('id, order_number').order('created_at', { ascending: false }).limit(50), profile),
  ])
  const requirementOptions = asRows<RequirementOption>(requirements)
  const orderOptions = asRows<OrderOption>(orders)
  const mockupRows = asRows<MockupRow>(mockups)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Design Mockups</h1>
        <p className="text-xs text-[#7A7267] mt-1">Attach mockup files to a requirement or order. Shared mockups are visible in the client portal.</p>
      </div>

      <form action={asFormAction(registerMockup)} className="grid gap-3 rounded-2xl border bg-white p-4 text-xs md:grid-cols-3">
        <input name="file_url" required placeholder="File URL" className="rounded-lg border px-2 py-2" />
        <input name="file_name" placeholder="File name" className="rounded-lg border px-2 py-2" />
        <MobileSheetSelect
          name="mime_type"
          label="File type"
          defaultValue="image/png"
          options={[
            { value: 'image/png', label: 'PNG' },
            { value: 'image/jpeg', label: 'JPEG' },
            { value: 'application/pdf', label: 'PDF' },
          ]}
        />
        <MobileSheetSelect
          name="requirement_id"
          label="Requirement"
          emptyLabel="Requirement (optional)"
          options={[
            { value: '', label: 'Requirement (optional)' },
            ...requirementOptions.map((r: RequirementOption) => ({ value: r.id, label: r.name })),
          ]}
        />
        <MobileSheetSelect
          name="order_id"
          label="Order"
          emptyLabel="Order (optional)"
          options={[
            { value: '', label: 'Order (optional)' },
            ...orderOptions.map((o: OrderOption) => ({
              value: o.id,
              label: o.order_number || o.id.slice(0, 8),
            })),
          ]}
        />
        <MobileSheetSelect
          name="visibility"
          label="Visibility"
          defaultValue="internal"
          options={[
            { value: 'internal', label: 'Internal only' },
            { value: 'client', label: 'Share with client' },
          ]}
        />
        <button className="rounded-lg bg-[#1A3022] py-2.5 font-semibold text-white md:col-span-3">Register mockup</button>
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        {mockupRows.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="p-3">File</th>
                <th className="p-3">Requirement</th>
                <th className="p-3">Order</th>
                <th className="p-3">Visibility</th>
                <th className="p-3">Uploaded</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockupRows.map((mockup: MockupRow) => {
                const requirement = oneRelation(mockup.requirement)
                const company = oneRelation(requirement?.company)
                const order = oneRelation(mockup.order)
                const uploader = oneRelation(mockup.uploader)
                const href = fileHref(mockup.storage_path ?? null)
                return (
                  <tr key={mockup.id} className="border-b text-sm">
                    <td className="p-3">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {mockup.file_name || 'View file'}
                        </a>
                      ) : mockup.file_name}
                      <p className="text-[11px] text-gray-500">{mockup.mime_type}</p>
                    </td>
                    <td className="p-3">
                      {requirement ? (
                        <div>
                          <p className="font-medium">{requirement.name}</p>
                          <p className="text-xs text-gray-500">{company?.name}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-3">
                      {mockup.order_id ? (
                        <Link href={`/crm/orders/${mockup.order_id}`} className="text-blue-600 hover:underline">{order?.order_number}</Link>
                      ) : '—'}
                    </td>
                    <td className="p-3 capitalize">{mockup.status === 'shared' ? 'Client-facing' : mockup.status || 'internal'}</td>
                    <td className="p-3">{uploader?.full_name || '—'} · {formatDate(mockup.created_at)}</td>
                    <td className="p-3 text-xs space-y-2">
                      <form action={asFormAction(updateMockup)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input type="hidden" name="id" value={mockup.id} />
                        <MobileSheetSelect
                          name="status"
                          label="Status"
                          defaultValue={mockup.status || 'draft'}
                          options={[
                            { value: 'draft', label: 'Internal' },
                            { value: 'shared', label: 'Client-facing' },
                            { value: 'approved', label: 'Approved' },
                            { value: 'rejected', label: 'Rejected' },
                          ]}
                        />
                        <button className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#1A3022] px-3 text-xs font-semibold text-white hover:bg-[#274433] hover:text-white">Save</button>
                      </form>
                      <ConfirmAction
                        title="Delete mockup?"
                        confirmLabel="Delete"
                        action={asFormAction(removeMockup)}
                        hiddenFields={{ id: mockup.id }}
                        description={<p>File: <span className="font-semibold">{mockup.file_name}</span></p>}
                      >
                        Delete
                      </ConfirmAction>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">No mockups uploaded yet.</div>
        )}
      </div>
    </div>
  )
}
